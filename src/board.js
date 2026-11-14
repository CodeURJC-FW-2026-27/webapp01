import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const router = express.Router();
export default router;

const client = new MongoClient('mongodb://localhost:27017');

const db = client.db('RISTORANTE');
const posts = db.collection('DISHES');


export async function addPost(post) {

    return await posts.insertOne(post);
}

export async function addManyPosts(postsArray) {
    
    return await posts.insertMany(postsArray);
}

export async function deletePost(id){

    return await posts.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function deletePosts(){

    return await posts.deleteMany();
}

export async function getPosts(){

    return await posts.find().toArray();
}

export async function getPostCount(){

    return await posts.countDocuments();
}

export async function getPagePost(page = 1){
    
    return await posts.find().limit(6).skip((page-1)*6).toArray();
}

/*
 * Aquí preparo la paginación del menú: obtengo los seis platos de la página
 * solicitada y creo los enlaces para ir a la página anterior, a otra página
 * o a la siguiente.
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

export async function getPost(id){

    return await posts.findOne({ _id: new ObjectId(id) });
}

