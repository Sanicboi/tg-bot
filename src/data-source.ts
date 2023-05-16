import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Answer } from "./entity/Answer"
import { Admin } from "./entity/Admin"
export const AppDataSource = new DataSource({
    type: "postgres",
    host: "db",
    port: 5432,
    username: "test",
    password: "test",
    database: "test",
    synchronize: true,
    logging: false,
    entities: [User, Admin, Answer],
    migrations: [],
    subscribers: [],
})
