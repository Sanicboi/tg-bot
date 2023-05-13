import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Answer } from "./entity/Answer"
import { Admin } from "./entity/Admin"
export const AppDataSource = new DataSource({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "test",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [User, Admin, Answer],
    migrations: [],
    subscribers: [],
})
