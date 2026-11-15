import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const router = express.Router();
export default router;

const client = new MongoClient('mongodb://localhost:27017');

const db = client.db('RISTORANTE');
const posts = db.collection('DISHES');

//Search bar's configuration
await posts.createIndex({ name: 'text' });


export async function addPost(post) {
    return await posts.insertOne(post);
}

export async function addManyPosts(postsArray) {

    return await posts.insertMany(postsArray);
}

export async function deletePost(id) {

    return await posts.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deletePosts() {

    return await posts.deleteMany();
}

export async function getPosts() {

    return await posts.find().toArray();
}

export async function getPostCount() {

    return await posts.countDocuments();
}

export async function getPagePost(page = 1) {

    return await posts.find().limit(6).skip((page - 1) * 6).toArray();
}


/**
 * Loads one page of dishes and builds the navigation data for the menu.
 * The collection is split into pages of 6 dishes: the requested page is used
 * to fetch its dishes, while the total document count determines how many
 * page links to create. The result contains `previous` and `next` links only
 * when those pages exist, plus every page link with a `current` flag. URLs
 * return to the menu section and include the selected page in the query string.
 * `requestedPage` should be a valid positive page number; a falsy value falls
 * back to page 1.
 */
export async function getPaginatedDishes(requestedPage = 1) {
    const page = requestedPage || 1;
    const currentPage = Number(page);
    const totalPages = Math.ceil((await getPostCount()) / 6);
    const dishes = await getPagePost(page);
    const pagination = {
        previous: currentPage > 1 ? { url: `/?page=${currentPage - 1}#menu` } : null,
        pages: Array.from({ length: totalPages }, (_, index) => ({
            number: index + 1,
            url: `/?page=${index + 1}#menu`,
            current: index + 1 === currentPage
        })),
        next: currentPage < totalPages ? { url: `/?page=${currentPage + 1}#menu` } : null
    };

    return { dishes, pagination };
}

export async function getElementsByName(name) {
    let result;
    if (name) {
        // resultados = await posts.find({ $text: { $search: name } }).toArray();
        result= await posts.find({
            name:{$regex:name, $options:'i'}//i makes the function do not care about capital letters
        }).toArray(); //Maybe a kind of sort?
    }
    return result;
}

export async function getElementsByCategory(category){
    let results;
    if(category){
        results=await posts.find({
            typeOfMeal:{$regex:category, $options:'i'}
        }).toArray();
    }
    return results;

}

export async function getPost(id) {

    return await posts.findOne({ _id: new ObjectId(id) });
}

export async function saveDish(dish){
    if(dish){
        let result= await posts.insertOne(dish)
        return result.acknowledged; //This returns the state of the query, true if was successfully, false otherwise
    }
    return false;
}

