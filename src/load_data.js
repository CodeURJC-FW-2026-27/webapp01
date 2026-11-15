import fs from 'node:fs/promises';
import * as board from './board.js';

export const UPLOADS_FOLDER_NAME = 'uploads/';
const DATA_FILE = new URL('../public/jsonfiles/dishesbbdd_mongodb.json', import.meta.url);
const IMAGES_FOLDER = new URL('../public/images/example_dishes/', import.meta.url);
const UPLOADS_FOLDER = new URL('../uploads/', import.meta.url);

await fs.mkdir(UPLOADS_FOLDER, { recursive: true });

const firstPageDishes = await board.getPagePost();
await checkAndLoadExampleDishes(firstPageDishes);

const menuCategories = [
    ['Drinks', 'Drinks'],
    ['Starters', 'Starters'],
    ['Main Courses', 'Main Courses'],
    ['Side Dishes', 'Side Dishes'],
    ['Desserts', 'Desserts / Breakfast']
];

/* Each pair contains the database typeOfMeal value and the label shown in the menu.
Returns objects for the HTML template; url filters by category, or returns to the full menu when active.
Example: getMenuCategories('Desserts') includes [
  { label: 'Drinks', active: true, url: '/' },
  { label: 'Starters', active: false, url: '/index?category=starters' }, ...] 
*/
export function getMenuCategories(activeCategory) {
    return menuCategories.map(([value, label]) => ({
        label,
        active: value === activeCategory,
        url: value === activeCategory ? '/' : `/index?category=${encodeURIComponent(value)}`
    }));
}

// This function reads the dishes from the JSON file and returns them as an array of objects.
export async function getDishes() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const dishes = JSON.parse(data);

    if (!Array.isArray(dishes)) {
        throw new TypeError('El JSON de platos debe contener una lista.');
    }

    return dishes;
}

// This function checks if there are any dishes in the database. If not, it loads example dishes from a JSON file and copies their images to the uploads folder.
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



