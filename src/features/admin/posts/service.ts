import type { Db } from "@/db";
import type { PostInput } from "./schema";
import * as repository from "./repository";

export const listPosts = (db: Db) => repository.findAll(db);

export const getPost = (db: Db, id: number) => repository.findById(db, id);

export const createPost = (db: Db, input: PostInput) =>
  repository.create(db, input);

export const updatePost = (db: Db, id: number, input: PostInput) =>
  repository.update(db, id, input);

export const deletePost = (db: Db, id: number) => repository.remove(db, id);
