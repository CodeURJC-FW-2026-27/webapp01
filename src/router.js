import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';

import * as board from './board.js';
import { getMenuCategories, UPLOADS_FOLDER_NAME } from './load_data.js';

const router = express.Router();
export default router;

const upload = multer({ dest: UPLOADS_FOLDER_NAME })
const PENDING_UPLOADS_FOLDER_NAME = path.join(UPLOADS_FOLDER_NAME, '.pending');
await fs.mkdir(PENDING_UPLOADS_FOLDER_NAME, { recursive: true });
const editUpload = multer({ dest: PENDING_UPLOADS_FOLDER_NAME });
const isValidPrice = value =>
    typeof value === 'string' && /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));

function renderConfirmation(res, { title, message, confirmUrl, fields = [] }) {
    return res.render('confirmation', {
        confirmationTitle: title,
        confirmationMessage: message,
        confirmUrl,
        hiddenFields: fields.map(([name, value]) => ({ name, value }))
    });
}

function getDishFormFields(body) {
    return [
        'newdishName',
        'newdishHealingProperties',
        'newdishTypeofmeal',
        'newdishChef',
        'newdishReview',
        'newdishPrice',
        'newdishDescription'
    ].map(name => ({
        name,
        value: typeof body[name] === 'string' ? body[name] : ''
    }));
}


async function removePendingUpload(filename) {
    if (typeof filename === 'string' && filename && path.basename(filename) === filename) {
        await fs.rm(path.join(PENDING_UPLOADS_FOLDER_NAME, filename), { force: true });
    }
}


// Validates a new dish and asks for confirmation before saving it.
router.post('/new_dish', editUpload.single('newdishImage'), async (req, res) => {
    const stagedImage = req.file?.filename || (typeof req.body.stagedImage === 'string' ? req.body.stagedImage : '');
    const errorPage = async (status, errorMessage) => {
        await removePendingUpload(stagedImage);
        return res.status(status).render('error', {
            errorMessage,
            returnFormUrl: '/new_dish',
            returnFormFields: getDishFormFields(req.body)
        });
    };
    const name = typeof req.body.newdishName === 'string' ? req.body.newdishName.trim() : '';
    const description = typeof req.body.newdishDescription === 'string'
        ? req.body.newdishDescription.trim()
        : '';
    const numberPrice = isValidPrice(req.body.newdishPrice) ? Number(req.body.newdishPrice) : NaN;

    if (req.body.confirmed === 'no') {
        await removePendingUpload(stagedImage);
        return res.render('new_dish', {
            dish: {
                name: req.body.newdishName,
                healingProperties: req.body.newdishHealingProperties,
                dishDescription: req.body.newdishDescription,
                typeOfMeal: req.body.newdishTypeofmeal,
                chef: req.body.newdishChef,
                foodCriticReview: req.body.newdishReview,
                price: req.body.newdishPrice
            },
            hasFormValues: true,
            isBreakfast: req.body.newdishTypeofmeal === 'Desserts',
            isDrinks: req.body.newdishTypeofmeal === 'Drinks',
            isMainCourse: req.body.newdishTypeofmeal === 'Main Courses',
            isSideDish: req.body.newdishTypeofmeal === 'Side Dishes',
            isTonio: req.body.newdishChef === 'Tonio Trussardi',
            isJoestar: req.body.newdishChef === 'Joestar Giovanna',
            isBruno: req.body.newdishChef === 'Bruno Bucciarati',
            isGioGio: req.body.newdishChef === 'Gio-Gio Gourmand',
            isBrando: req.body.newdishChef === "Brando d'Abruzzo",
            isCiocolata: req.body.newdishChef === 'Ciocolata Sorbett'
        });
    }

    if (!name) {
        return errorPage(400, 'The dish name cannot be empty.');
    }
    if (!description) {
        return errorPage(400, 'The dish description cannot be empty.');
    }
    if (!Number.isFinite(numberPrice) || numberPrice < 0 || numberPrice > 1000) {
        return errorPage(400, 'The price must be between 0 and 1000, with at most two decimal places.');
    }
    if (!req.body.newdishTypeofmeal) {
        return errorPage(400, 'You must choose a type of meal.');
    }
    if (description.length < 5 || description.length > 30) {
        return errorPage(400, 'The description must be between 5 and 30 characters.');
    }
    if (name[0] !== name[0].toUpperCase()) {
        return errorPage(400, 'The first letter of the dish name must be uppercase.');
    }
    if (!stagedImage) {
        return errorPage(400, 'Please upload an image for the dish.');
    }
    let promotedImage = false;
    try {

        const allDishes = await board.getPosts();
        const dishExists = allDishes.some(dish =>
            typeof dish.name === 'string' && dish.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (dishExists) {
            return errorPage(400, 'A dish with this name already exists.');
        }

        const dish = {
            name,
            healingProperties: req.body.newdishHealingProperties,
            dishDescription: description,
            typeOfMeal: req.body.newdishTypeofmeal,
            chef: req.body.newdishChef,
            foodCriticReview: req.body.newdishReview,
            price: numberPrice,
            imageFilename: stagedImage
        };

        if (req.body.confirmed !== 'yes' || req.file) {
            return renderConfirmation(res, {
                title: `Add ${name} to the menu?`,
                message: 'Save this new dish to the menu?',
                confirmUrl: '/new_dish',
                fields: [
                    ['newdishName', name],
                    ['newdishHealingProperties', req.body.newdishHealingProperties || ''],
                    ['newdishDescription', description],
                    ['newdishTypeofmeal', req.body.newdishTypeofmeal],
                    ['newdishChef', req.body.newdishChef],
                    ['newdishReview', req.body.newdishReview || ''],
                    ['newdishPrice', String(numberPrice)],
                    ['stagedImage', stagedImage]
                ]
            });
        }

        if (path.basename(stagedImage) !== stagedImage) {
            return errorPage(400, 'The uploaded image is invalid.');
        }
        await fs.access(path.join(PENDING_UPLOADS_FOLDER_NAME, stagedImage));
        await fs.rename(
            path.join(PENDING_UPLOADS_FOLDER_NAME, stagedImage),
            path.join(UPLOADS_FOLDER_NAME, stagedImage)
        );
        promotedImage = true;

        const saved = await board.saveDish(dish);
        if (!saved) {
            await fs.rm(path.join(UPLOADS_FOLDER_NAME, stagedImage), { force: true });
            return errorPage(500, 'The dish could not be saved.');
        }

        return res.redirect(303, '/');
    } catch (error) {
        console.error(error);
        await removePendingUpload(stagedImage);
        if (promotedImage) {
            await fs.rm(path.join(UPLOADS_FOLDER_NAME, stagedImage), { force: true });
        }
        return errorPage(500, 'Error al guardar el plato.');
    }
});

// Displays the requested page of the full menu.
router.get('/', async (req, res) => {
    const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    res.render('index', {
        isHome: true,
        dishes,
        pagination,
        categories: getMenuCategories()
    });
});

// Paginates a filtered list and prepares the menu navigation links.
async function renderFilteredDishes(res, filteredDishes, requestedPage, pageUrl, activeCategory) {
    const { dishes, pagination } = await board.getPaginatedDishes(requestedPage, filteredDishes, pageUrl);

    res.render('index', {
        dishes,
        pagination,
        categories: getMenuCategories(activeCategory)
    });
}

// Finds dishes by name and preserves the search term in pagination links.
async function renderSearchResults(res, searchTerm, requestedPage) {
    const filteredDishes = await board.getElementsByName(searchTerm);
    const pageUrl = page => `/index/buscar?fragmentoBusqueda=${encodeURIComponent(searchTerm)}&page=${page}#menu`;
    await renderFilteredDishes(res, filteredDishes, requestedPage, pageUrl);
}

// Filters dishes by their category.
router.get('/index', async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const filteredDishes = await board.getElementsByCategory(category);
    const pageUrl = page => `/index?category=${encodeURIComponent(category)}&page=${page}#menu`;
    await renderFilteredDishes(res, filteredDishes, req.query.page, pageUrl, category);
});

//Searches and renders index with the filtered items
router.post('/index/buscar', async (req, res) => {
    // searchTerm is the submitted text used to find dishes by name.
    const searchTerm = typeof req.body.fragmentoBusqueda === 'string'
        ? req.body.fragmentoBusqueda
        : '';

    if (searchTerm.trim() === '') {
        const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);
        res.render('index', {
            isHome: true,
            dishes,
            pagination,
            categories: getMenuCategories()
        });
    } else {
        await renderSearchResults(res, searchTerm, req.query.page);
    }
});

// Displays a results page using the search term stored in the URL.
router.get('/index/buscar', async (req, res) => {
    // searchTerm keeps the same search active when navigating between pages.
    const searchTerm = typeof req.query.fragmentoBusqueda === 'string'
        ? req.query.fragmentoBusqueda
        : '';

    if (searchTerm.trim() === '') {
        const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);
        return res.render('index', {
            isHome: true,
            dishes,
            pagination,
            categories: getMenuCategories()
        });
    }

    await renderSearchResults(res, searchTerm, req.query.page);
});

// Displays the restaurant information page.
router.get('/about', async (req, res) => {
    res.render('about', { isAbout: true, showNewDish: true });
});

// Displays the reservation page.
router.get('/reserve', async (req, res) => {
    res.render('store', { isReserve: true, showNewDish: true });
});

/*
 * Dish detail route walkthrough:
 * - router.get registers a page that the browser opens with an HTTP GET request.
 * - req.query.dishId reads the dish ID from a URL such as /show_dish?dishId=123.
 * - board.getPost(dishId) looks up that dish in MongoDB; await waits for the result.
 * - dishIngredients is the dish's ingredient list, or an empty list if there is none.
 * - map creates display-ready ingredient objects without changing the database data.
 *   Each dietary flag is true or false; filter(Boolean) removes false entries,
 *   and join(', ') turns the remaining names into one readable string.
 * - dietaryProperties pairs each database field with its label for the page.
 *   some() checks whether at least one ingredient has that field set to true;
 *   filter() keeps matching labels and map() turns them into a list of names.
 * - res.render sends the dish_detail template to the browser. The second argument
 *   is its view data: showNewDish controls the shared navigation, while dish
 *   contains the dish, prepared ingredients, positive dietary labels, and a
 *   boolean that lets the template hide the label list when it is empty.
 */
// Finds a dish by ID and displays its details and dietary information.
router.get('/show_dish', async (req, res) => {
    const dishId = req.query.dishId;
    const dish = await board.getPost(dishId);

    const dishIngredients = Array.isArray(dish?.ingredients) ? dish.ingredients : [];
    const ingredients = dishIngredients.map(ingredient => {
        const dietaryLabels = [
            ingredient.lactoseIntolerancy === true && 'Lactose intolerance',
            ingredient.celiac === true && 'Celiac',
            ingredient.organic === true && 'Organic',
            ingredient.vegan === true && 'Vegan'
        ].filter(Boolean).join(', ');

        return { ...ingredient, dishId, dietaryLabels };
    });
    const dietaryProperties = [
        ['lactoseIntolerancy', 'Lactose intolerance'],
        ['celiac', 'Celiac'],
        ['organic', 'Organic'],
        ['vegan', 'Vegan']
    ];
    const dietaryLabels = dietaryProperties
        .filter(([property]) => dishIngredients.some(ingredient => ingredient[property] === true))
        .map(([, label]) => label);

    res.render('dish_detail', {
        showNewDish: false,
        dish: { ...dish, ingredients, dietaryLabels, hasDietaryLabels: dietaryLabels.length > 0 }
    });
});

// Displays the form for creating a dish.
router.get('/new_dish', async (req, res) => {
    res.render('new_dish', { showNewDish: false });
});

// Sends the image associated with the requested dish to the browser.
router.get('/image/:id', async (req, res) => {
    const post = await board.getPost(req.params.id);
    if (!post?.imageFilename) {
        return res.sendStatus(404);
    }

    return res.sendFile(post.imageFilename, {
        root: path.resolve(UPLOADS_FOLDER_NAME)
    });
});

// Shows a confirmation prompt before deleting the dish.
router.get('/delete_dish', async (req, res) => {
    const dishId = req.query.dishId;
    try {
        const dish = await board.getPost(dishId);
        if (!dish) {
            return res.status(404).render('error', {
                errorMessage: 'The dish could not be found.'
            });
        }

        return renderConfirmation(res, {
            title: `Delete ${dish.name}?`,
            message: 'This will permanently remove the dish from the menu.',
            confirmUrl: `/delete_dish?dishId=${encodeURIComponent(dishId)}`
        });
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', { errorMessage: 'A database error occurred while loading the dish.' });
    }
});

// Deletes the dish only after the user confirms.
router.post('/delete_dish', async (req, res) => {
    const dishId = req.query.dishId;
    if (req.body.confirmed === 'no') {
        return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
    }
    if (req.body.confirmed !== 'yes') {
        return res.status(400).render('error', { errorMessage: 'Choose whether to continue with the operation.' });
    }

    try {
        const dish = await board.deletePost(dishId);
        if (!dish) {
            return res.status(404).render('error', { errorMessage: 'The dish could not be found or deleted.' });
        }
        if (dish.imageFilename) {
            await fs.rm(UPLOADS_FOLDER_NAME + '/' + dish.imageFilename, { force: true });
        }
        return res.redirect(303, '/');
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            errorMessage: 'A database or server error occurred while deleting the dish.'
        });
    }
});




router.post('/dish/:id/ingredient', async (req, res) => {
    const dishId = req.params.id;
    if (req.body.confirmed === 'no') {
        return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
    }
    const ingredientName = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!ingredientName) {
        return res.status(400).render('error', { dishId, errorMessage: 'The ingredient name cannot be empty.' });
    }

    const dish = await board.getPost(dishId);
    if (!dish) {
        return res.status(404).render('error', { errorMessage: 'Dish not found.' });
    }

    const dishIngredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
    const ingredientExists = dishIngredients.some(ingredient => ingredient.name.toLowerCase() === ingredientName.toLowerCase());

    if (ingredientExists) {
        return res.status(400).render('error', { dishId, errorMessage: 'This ingredient already exists in the dish.' });
    }

    const newIngredient = {
        name: ingredientName,
        lactoseIntolerancy: req.body.lactoseIntolerancy === 'true',
        celiac: req.body.celiac === 'true',
        organic: req.body.organic === 'true',
        vegan: req.body.vegan === 'true'
    };

    if (req.body.confirmed !== 'yes') {
        return renderConfirmation(res, {
            title: `Add ${ingredientName}?`,
            message: 'Add this ingredient to the dish?',
            confirmUrl: `/dish/${encodeURIComponent(dishId)}/ingredient`,
            fields: [
                ['name', newIngredient.name],
                ['lactoseIntolerancy', String(newIngredient.lactoseIntolerancy)],
                ['celiac', String(newIngredient.celiac)],
                ['organic', String(newIngredient.organic)],
                ['vegan', String(newIngredient.vegan)]
            ]
        });
    }

    const success = await board.addIngredientDish(dishId, newIngredient);

    if (success) {
        return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
    } else {
        return res.status(400).render('error', { dishId, errorMessage: 'The ingredient could not be added to the dish.' });
    }
});


// Shows a confirmation prompt before removing an ingredient.
router.get('/dish/:id/ingredient/delete', async (req, res) => {
    const dishId = req.params.id;
    const ingredientName = req.query.name;
    try {
        const dish = await board.getPost(dishId);
        if (!dish || !dish.ingredients?.some(ingredient => ingredient.name === ingredientName)) {
            return res.status(404).render('error', {
                dishId,
                errorMessage: 'The ingredient could not be found in this dish.'
            });
        }

        return renderConfirmation(res, {
            title: `Remove ${ingredientName}?`,
            message: 'This will remove the ingredient from the dish.',
            confirmUrl: `/dish/${encodeURIComponent(dishId)}/ingredient/delete?name=${encodeURIComponent(ingredientName)}`
        });
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            dishId,
            errorMessage: 'A database error occurred while deleting the ingredient.'
        });
    }
});

router.post('/dish/:id/ingredient/delete', async (req, res) => {
    const dishId = req.params.id;
    const ingredientName = req.query.name;
    if (req.body.confirmed === 'no') {
        return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
    }
    if (req.body.confirmed !== 'yes') {
        return res.status(400).render('error', { dishId, errorMessage: 'Choose whether to continue with the operation.' });
    }

    try {
        const success = await board.deleteIngredientDish(dishId, ingredientName);
        if (!success) {
            return res.status(404).render('error', {
                dishId,
                errorMessage: 'The ingredient could not be found or deleted from the dish.'
            });
        }
        return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            dishId,
            errorMessage: 'A database error occurred while deleting the ingredient.'
        });
    }
});

// Loads the selected ingredient into the edit form.
router.get('/dish/:id/ingredient/edit', async (req, res) => {
    const dishId = req.params.id;
    const ingredientName = req.query.name;
    let dish;
    try {
        dish = await board.getPost(dishId);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            dishId,
            errorMessage: 'A database error occurred while loading the ingredient.'
        });
    }

    if (!dish) { // In case someone modifies the URL and the dish doesn't exist, we return a 404 error.
        return res.status(404).render('error', { errorMessage: 'Dish not found.' });
    }

    const ingredient = dish.ingredients?.find(ingredient => ingredient.name === ingredientName);
    if (!ingredient) {
        return res.status(404).render('error', { dishId, errorMessage: 'Ingredient not found in this dish.' });
    }

    res.render('edit_ingredients', {
        dishId,
        ingredient,
        oldName: ingredient.name
    });
});

// Saves the edited ingredient and displays its confirmation page.
router.post('/dish/:id/ingredient/edit', async (req, res) => {
    const dishId = req.params.id;
    const oldName = req.body.oldName;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    const updatedIngredient = {
        name,
        lactoseIntolerancy: req.body.lactoseIntolerancy === 'true',
        celiac: req.body.celiac === 'true',
        organic: req.body.organic === 'true',
        vegan: req.body.vegan === 'true'
    };

    if (req.body.confirmed === 'no') {
        return res.render('edit_ingredients', { dishId, oldName, ingredient: updatedIngredient });
    }
    if (!oldName || !name) {
        return res.status(400).render('error', { dishId, errorMessage: 'The ingredient name cannot be empty.' });
    }

    if (req.body.confirmed !== 'yes') {
        return renderConfirmation(res, {
            title: `Save changes to ${name}?`,
            message: 'Update this ingredient in the dish?',
            confirmUrl: `/dish/${encodeURIComponent(dishId)}/ingredient/edit`,
            fields: [
                ['oldName', oldName],
                ['name', updatedIngredient.name],
                ['lactoseIntolerancy', String(updatedIngredient.lactoseIntolerancy)],
                ['celiac', String(updatedIngredient.celiac)],
                ['organic', String(updatedIngredient.organic)],
                ['vegan', String(updatedIngredient.vegan)]
            ]
        });
    }

    let success;
    try {
        success = await board.updateIngredientDish(dishId, oldName, updatedIngredient);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            dishId,
            errorMessage: 'A database error occurred while updating the ingredient.'
        });
    }
    if (!success) {
        return res.status(404).render('error', { dishId, errorMessage: 'The ingredient could not be found or updated.' });
    }
    
    return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
});

// Loads the dish into the form for editing.

router.get('/edit_dish', async (req, res) => {
    const dishId = req.query.dishId;
    let dish;
    try {
        dish = await board.getPost(dishId);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            errorMessage: 'A database error occurred while loading the dish.'
        });
    }

    if (!dish) {
        return res.status(404).render('error', { errorMessage: 'Dish not found.' });
    }

    res.render('new_dish', {
        dish,
        isEdit: true,
        showNewDish: false,
        isBreakfast: dish.typeOfMeal === 'Desserts',
        isDrinks: dish.typeOfMeal === 'Drinks',
        isMainCourse: dish.typeOfMeal === 'Starters',
        isSideDish: dish.typeOfMeal === 'Side Dishes',
        isTonio: dish.chef === 'Tonio Trussardi',
        isJoestar: dish.chef === 'Joestar Giovanna',
        isBruno: dish.chef === 'Bruno Bucciarati',
        isGioGio: dish.chef === 'Gio-Gio Gourmand',
        isBrando: dish.chef === "Brando d'Abruzzo",
        isCiocolata: dish.chef === 'Ciocolata Sorbett'
    });
});


// Saves the edited dish and displays its confirmation page.

router.post('/dish/:id/edit', editUpload.single('newdishImage'), async (req, res) => {
    const dishId = req.params.id;
    const name = typeof req.body.newdishName === 'string' ? req.body.newdishName.trim() : '';
    const numberPrice = isValidPrice(req.body.newdishPrice) ? Number(req.body.newdishPrice) : NaN;
    const stagedImage = req.file?.filename || (typeof req.body.stagedImage === 'string' ? req.body.stagedImage : '');

    if (req.body.confirmed === 'no') {
        await removePendingUpload(stagedImage);
        let currentDish;
        try {
            currentDish = await board.getPost(dishId);
        } catch (error) {
            console.error(error);
            return res.status(500).render('error', { errorMessage: 'A database error occurred while loading the dish.' });
        }
        if (!currentDish) {
            return res.status(404).render('error', { errorMessage: 'Dish not found.' });
        }

        const formDish = {
            _id: dishId,
            name: req.body.newdishName,
            healingProperties: req.body.newdishHealingProperties,
            dishDescription: req.body.newdishDescription,
            typeOfMeal: req.body.newdishTypeofmeal,
            chef: req.body.newdishChef,
            foodCriticReview: req.body.newdishReview,
            price: req.body.newdishPrice
        };
        return res.render('new_dish', {
            dish: formDish,
            isEdit: true,
            showNewDish: false,
            isBreakfast: formDish.typeOfMeal === 'Desserts',
            isDrinks: formDish.typeOfMeal === 'Drinks',
            isMainCourse: formDish.typeOfMeal === 'Main Courses',
            isSideDish: formDish.typeOfMeal === 'Side Dishes',
            isTonio: formDish.chef === 'Tonio Trussardi',
            isJoestar: formDish.chef === 'Joestar Giovanna',
            isBruno: formDish.chef === 'Bruno Bucciarati',
            isGioGio: formDish.chef === 'Gio-Gio Gourmand',
            isBrando: formDish.chef === "Brando d'Abruzzo",
            isCiocolata: formDish.chef === 'Ciocolata Sorbett'
        });
    }

    if (!name) {
        await removePendingUpload(stagedImage);
        return res.status(400).render('error', {
            errorMessage: 'The dish name cannot be empty.',
            returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            returnFormFields: getDishFormFields(req.body)
        });
    }
    if (!Number.isFinite(numberPrice) || numberPrice < 0 || numberPrice > 1000) {
        await removePendingUpload(stagedImage);
        return res.status(400).render('error', {
            errorMessage: 'The price must be between 0 and 1000, with at most two decimal places.',
            returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            returnFormFields: getDishFormFields(req.body)
        });
    }
    let currentDish;
    try {
        currentDish = await board.getPost(dishId);
    } catch (error) {
        console.error(error);
        await removePendingUpload(stagedImage);
        return res.status(500).render('error', {
            errorMessage: 'A database error occurred while loading the dish for editing.'
        });
    }

    if (!currentDish) {
        await removePendingUpload(stagedImage);
        return res.status(404).render('error', { errorMessage: 'Dish not found.' });
    }

    const allDishes = await board.getPosts();
    const dishExists = allDishes.some(dish =>
        dish._id.toString() !== dishId &&
        typeof dish.name === 'string' &&
        dish.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (dishExists) {
        await removePendingUpload(stagedImage);
        return res.status(400).render('error', {
            errorMessage: 'A dish with this name already exists.',
            returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            returnFormFields: getDishFormFields(req.body)
        });
    }

    const updatedDish = {
        name,
        healingProperties: req.body.newdishHealingProperties,
        dishDescription: req.body.newdishDescription,
        typeOfMeal: req.body.newdishTypeofmeal,
        chef: req.body.newdishChef,
        foodCriticReview: req.body.newdishReview,
        price: numberPrice,
        imageFilename: stagedImage || currentDish.imageFilename
    };

    if (req.body.confirmed !== 'yes') {
        return renderConfirmation(res, {
            title: `Save changes to ${name}?`,
            message: 'Update this dish with the submitted details?',
            confirmUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            fields: [
                ['newdishName', name],
                ['newdishHealingProperties', req.body.newdishHealingProperties || ''],
                ['newdishDescription', req.body.newdishDescription || ''],
                ['newdishTypeofmeal', req.body.newdishTypeofmeal || ''],
                ['newdishChef', req.body.newdishChef || ''],
                ['newdishReview', req.body.newdishReview || ''],
                ['newdishPrice', String(numberPrice)],
                ['stagedImage', stagedImage]
            ]
        });
    }

    if (stagedImage) {
        if (path.basename(stagedImage) !== stagedImage) {
            return res.status(400).render('error', {
                errorMessage: 'The uploaded image is invalid.',
                returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
                returnFormFields: getDishFormFields(req.body)
            });
        }
        try {
            await fs.access(path.join(PENDING_UPLOADS_FOLDER_NAME, stagedImage));
            await fs.rename(
                path.join(PENDING_UPLOADS_FOLDER_NAME, stagedImage),
                path.join(UPLOADS_FOLDER_NAME, stagedImage)
            );
        } catch (error) {
            console.error(error);
            return res.status(400).render('error', {
                errorMessage: 'The uploaded image is no longer available. Please try again.',
                returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
                returnFormFields: getDishFormFields(req.body)
            });
        }
    }

    let success;
    try {
        success = await board.updateDish(dishId, updatedDish);
    } catch (error) {
        console.error(error);
        if (stagedImage) {
            await fs.rm(path.join(UPLOADS_FOLDER_NAME, stagedImage), { force: true });
        }
        return res.status(500).render('error', {
            errorMessage: 'A database error occurred while updating the dish.',
            returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            returnFormFields: getDishFormFields(req.body)
        });
    }

    if (!success) {
        if (stagedImage) {
            await fs.rm(path.join(UPLOADS_FOLDER_NAME, stagedImage), { force: true });
        }
        return res.status(400).render('error', {
            errorMessage: 'The dish could not be updated.',
            returnFormUrl: `/dish/${encodeURIComponent(dishId)}/edit`,
            returnFormFields: getDishFormFields(req.body)
        });
    }

    if (stagedImage && currentDish.imageFilename && currentDish.imageFilename !== stagedImage) {
        await fs.rm(path.join(UPLOADS_FOLDER_NAME, currentDish.imageFilename), { force: true });
    }
    return res.redirect(303, `/show_dish?dishId=${encodeURIComponent(dishId)}`);
});

// --------------NOT USING----------------------

// Creates a post from the submitted form and its optional image.
router.post('/post/new', upload.single('image'), async (req, res) => {

    let post = {
        user: req.body.user,
        title: req.body.title,
        text: req.body.text,
        imageFilename: req.file?.filename
    };

    await board.addPost(post);

    res.render('saved_post', { _id: post._id.toString() });

});

// Finds a post by ID and displays its content.
router.get('/post/:id', async (req, res) => {

    let post = await board.getPost(req.params.id);

    res.render('show_post', { post });
});

// Deletes a post and its associated image, if present.
router.get('/post/:id/delete', async (req, res) => {

    const post = await board.getPost(req.params.id);
    if (!post) {
        return res.status(404).render('error', { errorMessage: 'The post could not be found.' });
    }
    return renderConfirmation(res, {
        title: `Delete ${post.name || post.title || 'this post'}?`,
        message: 'This will permanently remove the post.',
        confirmUrl: `/post/${encodeURIComponent(req.params.id)}/delete`
    });
});

router.post('/post/:id/delete', async (req, res) => {
    if (req.body.confirmed === 'no') {
        return res.redirect(303, '/');
    }
    if (req.body.confirmed !== 'yes') {
        return res.status(400).render('error', { errorMessage: 'Choose whether to continue with the operation.' });
    }

    const post = await board.deletePost(req.params.id);
    if (!post) {
        return res.status(404).render('error', { errorMessage: 'The post could not be found or deleted.' });
    }
    if (post.imageFilename) {
        await fs.rm(path.join(UPLOADS_FOLDER_NAME, post.imageFilename), { force: true });
    }
    return res.redirect(303, '/');
});


