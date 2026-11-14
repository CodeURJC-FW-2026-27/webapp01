import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';

import * as board from './board.js';
import { UPLOADS_FOLDER_NAME } from './load_data.js';

const router = express.Router();
export default router;

const upload = multer({ dest: board.UPLOADS_FOLDER_NAME })

router.get('/', async (req, res) => {
    const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    res.render('index', {
        isHome: true,
        dishes,
        pagination
    });
});
// filters the item by its category (drinks, desserts....)
router.get('/index', async(req,res)=>{
    // const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    let resultados= await board.getElementsByCategory(req.query.category);
    res.render('index', {dishes: resultados});

});

//Searches and renders index with the filtered items
router.post('/index/buscar', async (req, res) => {
    // const { dishes, pagination } = await board.getPaginatedDishes(req.query.page);

    let resultados = await board.getElementsByName(req.body.fragmentoBusqueda);

    // res.render('index', { dishes: resultados ,dishes, pagination});
    res.render('index',{
        dishes:resultados
    });

});

router.get('/about', async (req, res) => {
    res.render('about', { isAbout: true, showNewDish: true });
});

router.get('/reserve', async (req, res) => {
    res.render('store', { isReserve: true, showNewDish: true });
});

router.get('/show-dish', async (req, res) => {
    const dishid = req.query._id;
    res.render('new_dish', { showNewDish: false, dishid: dishid });
});

router.get('/new-dish', async (req, res) => {
    res.render('new_dish', { showNewDish: false });
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

router.get('/post/:id/image', async (req, res) => {

    let post = await board.getPost(req.params.id);

    console.log(UPLOADS_FOLDER_NAME + '/' + post.imageFilename);
    res.download(UPLOADS_FOLDER_NAME + '/' + post.imageFilename);

});

