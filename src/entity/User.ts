import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm"
import { Answer } from "./Answer"

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number

    @Column({
	type: 'bigint'
	})
    chatId: string

    @Column()
    name: string

    @Column({
	nullable: true
   })
    phone: string

    @Column({
        nullable: true
   })
    token: string

    @Column({
        nullable: true
   })
    enteredPhoneNumber: boolean

    @Column({
        nullable: true
   })
    enteredToken: boolean

    @Column({
        nullable: true
   })
    enteredPromo: boolean

    @OneToMany(() => Answer, (answer) => answer.user)
    answers: Answer[]
}
