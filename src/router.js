import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as board from './board.js';
import { getMenuCategories, UPLOADS_FOLDER_NAME } from './load_data.js';

const router = express.Router();
export default router;

const upload = multer({ dest: UPLOADS_FOLDER_NAME })

router.get('/', async (req, res) => {
    const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    res.render('index', {
        isHome: true,
        dishes,
        pagination,
        categories: getMenuCategories()
    });
});
// filters the item by its category (drinks, desserts....)
router.get('/index', async(req,res)=>{
    // const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    let resultados= await board.getElementsByCategory(req.query.category);
    res.render('index', {
        dishes: resultados,
        categories: getMenuCategories(req.query.category)
    });

});

//Searches and renders index with the filtered items
router.post('/index/buscar', async (req, res) => {
    // const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    let resultados = await board.getElementsByName(req.body.fragmentoBusqueda);

    // res.render('index', { dishes: resultados ,dishes, pagination});
    res.render('index',{
        dishes:resultados,
        categories: getMenuCategories()
    });

});

router.get('/about', async (req, res) => {
    res.render('about', { isAbout: true, showNewDish: true });
});

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

        return { ...ingredient, dietaryLabels };
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

router.get('/new_dish', async (req, res) => {
    res.render('new_dish', { showNewDish: false });
});

router.get('/image/:id', async (req, res) => {

    let post = await board.getPost(req.params.id);

    res.download(UPLOADS_FOLDER_NAME + '/' + post.imageFilename);

});


// ------------------------------------

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

router.get('/post/:id', async (req, res) => {

    let post = await board.getPost(req.params.id);

    res.render('show_post', { post });
});

router.get('/post/:id/delete', async (req, res) => {

    let post = await board.deletePost(req.params.id);

    if (post && post.imageFilename) {
        await fs.rm(board.UPLOADS_FOLDER_NAME + '/' + post.imageFilename);
    }

    res.render('deleted_post');
});


