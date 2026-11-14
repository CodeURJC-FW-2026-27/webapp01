import fs from 'node:fs/promises';
import * as board from './board.js';

const UPLOADS_FOLDER_NAME = './uploads';
const DATA_FILE = new URL('../public/jsonfiles/dishesbbdd_mongodb.json', import.meta.url);
const IMAGES_FOLDER = new URL('../public/images/example_dishes/', import.meta.url);
const UPLOADS_FOLDER = new URL('../uploads/', import.meta.url);

await fs.mkdir(UPLOADS_FOLDER, { recursive: true });

const firstPageDishes = await board.getPagePost();
await checkAndLoadExampleDishes(firstPageDishes);

export async function getDishes() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const dishes = JSON.parse(data);

    if (!Array.isArray(dishes)) {
        throw new TypeError('El JSON de platos debe contener una lista.');
    }

    return dishes;
}

export async function checkAndLoadExampleDishes(dishes) {
   
    if (!dishes || dishes.length === 0) {
        await fs.cp(IMAGES_FOLDER, UPLOADS_FOLDER, {
            recursive: true,
            force: false,
            errorOnExist: false
        });
        const dishesFromFile = await getDishes();
        await board.addManyPosts(dishesFromFile);
        console.log('No habia platos en la base de datos, se han cargado los platos de ejemplo desde el archivo JSON. En total se han cargado ' + dishesFromFile.length + ' platos.');
    } 
    
}

export async function passImagesForCommits(dishes) {
   
        await fs.cp(IMAGES_FOLDER, UPLOADS_FOLDER, {
            recursive: true,
            force: false,
            errorOnExist: false
        });
       
 
    
}



