import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    chatId: number;

    // @Column()
    // userId: number;
}