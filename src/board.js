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
 * Returns one page of up to six dishes and the matching navigation links.
 * Without `filteredDishes`, it paginates the full collection; when a filtered
 * list is provided, it slices that list instead. `pageUrl` builds links for
 * the current view, so searches and categories can preserve their filter.
 * `requestedPage` is the page number and defaults to page 1 when falsy.
 */
export async function getPaginatedDishes(requestedPage = 1, filteredDishes = null, pageUrl = page => `/?page=${page}#menu`) {
    const page = requestedPage || 1;
    const currentPage = Number(page);
    const totalDishes = Array.isArray(filteredDishes) ? filteredDishes.length : await getPostCount();
    const totalPages = Math.ceil(totalDishes / 6);
    const dishes = Array.isArray(filteredDishes)
        ? filteredDishes.slice((currentPage - 1) * 6, currentPage * 6)
        : await getPagePost(page);
    const pagination = {
        previous: currentPage > 1 ? { url: pageUrl(currentPage - 1) } : null,
        pages: Array.from({ length: totalPages }, (_, index) => ({
            number: index + 1,
            url: pageUrl(index + 1),
            current: index + 1 === currentPage
        })),
        next: currentPage < totalPages ? { url: pageUrl(currentPage + 1) } : null
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



export async function addIngredientDish(dishId, ingredient) {
    if (dishId && ingredient) {
        const result = await posts.updateOne(
            { _id: new ObjectId(dishId) },
            { $push: { ingredients: ingredient } }
        );
        return result.modifiedCount > 0; // Returns true if the dish was updated, false otherwise
    }
    return false; // If there's no dishID or ingredient, returns false
}


export async function deleteIngredientDish(dishId, ingredientName) {
    if (dishId && ingredientName) {
        const result = await posts.updateOne(
            {_id: new ObjectId(dishId) },
            { $pull: { ingredients: { name: ingredientName } } }
        );
        return result.modifiedCount > 0; // Returns true if the dish was updated, false otherwise
    }
    return false; // If there's no dishID or ingredient, returns false
}

export async function updateIngredientDish(dishId, oldName, ingredient) {
    if (!dishId || !oldName || !ingredient?.name) {  // We check if the dishId, oldName, and ingredient are provided if not return false
        return false;  
    }

    const result = await posts.updateOne(
        { _id: new ObjectId(dishId), 'ingredients.name': oldName },
        { $set: { 'ingredients.$': ingredient } }
    );

    return result.matchedCount > 0;
}

export async function updateDish(dishId, updatedDish) {
    if ((!dishId || !updatedDish)) { // We check if the dishId and the dish to update are provided, if not return false
        return false;
    }

    const result = await posts.updateOne(
        {_id: new ObjectId(dishId)},
        {$set: updatedDish}
    )

    return result.matchedCount > 0;

}



