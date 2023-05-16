import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'bigint'})
    chatId: string;

    // @Column()
    // userId: number;
}
