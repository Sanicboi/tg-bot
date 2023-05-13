import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm"
import { Answer } from "./Answer"

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    chatId: number

    @Column({
        charset: "koi8r",
    })
    name: string

    @Column()
    phone: string

    @Column()
    token: string

    @Column()
    enteredPhoneNumber: boolean

    @Column()
    enteredToken: boolean

    @Column()
    enteredPromo: boolean

    @OneToMany(() => Answer, (answer) => answer.user)
    answers: Answer[]
}
