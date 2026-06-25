import type { Db } from "@/db";
import * as repository from "./repository";

export const listPosts = (db: Db) => repository.findAll(db);

export const getPost = (db: Db, id: number) => repository.findById(db, id);
