import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as board from './board.js';
import { getMenuCategories, UPLOADS_FOLDER_NAME } from './load_data.js';

const router = express.Router();
export default router;

const upload = multer({ dest: UPLOADS_FOLDER_NAME })


// Receives, validates, and saves a new dish, then displays the menu.
router.post('/new_dish', upload.single('newdishImage'), async (req, res) => {
    const errorPage = (status, errorMessage) => res.status(status).render('error', {
        errorMessage,
        returnUrl: '/new_dish',
        returnLabel: 'Return to create dish'
    });
    const name = typeof req.body.newdishName === 'string' ? req.body.newdishName.trim() : '';
    const description = typeof req.body.newdishDescription === 'string'
        ? req.body.newdishDescription.trim()
        : '';
    const numberPrice = Number(req.body.newdishPrice);

    if (!name) {
        return errorPage(400, 'The dish name cannot be empty.');
    }
    if (!description) {
        return errorPage(400, 'The dish description cannot be empty.');
    }
    if (!Number.isFinite(numberPrice) || numberPrice <= 0) {
        return errorPage(400, 'The price must be a number greater than zero.');
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
    if (!req.file) {
        return errorPage(400, 'Please upload an image for the dish.');
    }
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
            price: req.body.newdishPrice,
            imageFilename: req.file.filename
        };
        const saved = await board.saveDish(dish);
        if (!saved) {
            return errorPage(500, 'The dish could not be saved.');
        }

        const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);
        return res.render('index', {
            isHome: true,
            dishes,
            pagination,
            categories: getMenuCategories()
        });
    } catch (error) {
        console.error(error);
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

    let post = await board.getPost(req.params.id);

    res.download(UPLOADS_FOLDER_NAME + '/' + post.imageFilename);

});

// Delete a dish by its ID and remove its image file if it exists.
router.get('/delete_dish', async (req, res) => {
    const dishId = req.query.dishId;
    try {
        const dish = await board.deletePost(dishId);
        if (!dish) {
            return res.status(404).render('error', {
                errorMessage: 'The dish could not be found or deleted.'
            });
        }

        if (dish.imageFilename) {
            await fs.rm(UPLOADS_FOLDER_NAME + '/' + dish.imageFilename, { force: true });
        }

        return res.render('confirmation', { dishName: dish.name, showNewDish: false });
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            errorMessage: 'A database or server error occurred while deleting the dish.'
        });
    }
});




router.post('/dish/:id/ingredient', async (req, res) => {
    const dishId = req.params.id;
    const ingredientName = req.body.name ? req.body.name.trim() : '';

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
        name: req.body.name,
        lactoseIntolerancy: req.body.lactoseIntolerancy === 'true',
        celiac: req.body.celiac === 'true',
        organic: req.body.organic === 'true',
        vegan: req.body.vegan === 'true'
    };

    const success = await board.addIngredientDish(dishId, newIngredient);

    if (success) {
        res.render('confirmation', {
            dishId,
            ingredientName: newIngredient.name,
            borrado: false,
            EditIng: false
        });
    } else {
        res.status(400).render('error', { dishId, errorMessage: 'The ingredient could not be added to the dish.' });
    }
});



router.get('/dish/:id/ingredient/delete', async (req, res) => {
    const dishId = req.params.id;
    const ingredientName = req.query.name;
    try {
        const success = await board.deleteIngredientDish(dishId, ingredientName);
        if (!success) {
            return res.status(404).render('error', {
                dishId,
                errorMessage: 'The ingredient could not be found or deleted from the dish.'
            });
        }

        return res.render('confirmation', {
            dishId,
            ingredientName,
            borrado: true,
            EditIng: false
        });
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
        ingredient
    });
});

// Saves the edited ingredient and displays its confirmation page.
router.post('/dish/:id/ingredient/edit', async (req, res) => {
    const dishId = req.params.id;
    const oldName = req.body.oldName;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!oldName || !name) {
        return res.status(400).render('error', { dishId, errorMessage: 'The ingredient name cannot be empty.' });
    }

    const updatedIngredient = {
        name,
        lactoseIntolerancy: req.body.lactoseIntolerancy === 'true',
        celiac: req.body.celiac === 'true',
        organic: req.body.organic === 'true',
        vegan: req.body.vegan === 'true'
    };

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
    
    res.render('confirmation', {
        dishId,
        ingredientName: name,
        EditIng: true
    });
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

router.post('/dish/:id/edit', upload.single('newdishImage'), async (req, res) => {
    const dishId = req.params.id;
    const allDishes = await board.getPosts();
    const dishExists = allDishes.some(dish => dish.name.toLowerCase() === name.toLowerCase());
    let currentDish;
    try {
        currentDish = await board.getPost(dishId);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            errorMessage: 'A database error occurred while loading the dish for editing.'
        });
    }

    if (!currentDish) {
        return res.status(404).render('error', { errorMessage: 'Dish not found.' });
    }

    if (dishExists) {
        return res.status(400).render('error', { errorMessage: ' A dish with this name already exists.' });
    }

    const updatedDish = {
        name: req.body.newdishName,
        healingProperties: req.body.newdishHealingProperties,
        dishDescription: req.body.newdishDescription,
        typeOfMeal: req.body.newdishTypeofmeal,
        chef: req.body.newdishChef,
        foodCriticReview: req.body.newdishReview,
        price: req.body.newdishPrice,
        imageFilename: req.file ? req.file.filename : currentDish.imageFilename
    };

    let success;
    try {
        success = await board.updateDish(dishId, updatedDish);
    } catch (error) {
        console.error(error);
        return res.status(500).render('error', {
            dishId,
            errorMessage: 'A database error occurred while updating the dish.'
        });
    }

    if (!success) {
        return res.status(400).render('error', { dishId, errorMessage: 'The dish could not be updated.' });
    }

    res.render('confirmation', {
        dishId,
        dishName: updatedDish.name,
        EditDish: true
    });
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

    let post = await board.deletePost(req.params.id);

    if (post && post.imageFilename) {
        await fs.rm(board.UPLOADS_FOLDER_NAME + '/' + post.imageFilename);
    }

    res.render('confirmation');
});


