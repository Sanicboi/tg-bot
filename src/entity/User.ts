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
    token: string


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

    @Column({
        nullable: true,
    })
    statsToken: string

    @Column()
    enteredStats: boolean

    @Column()
    signupDate: Date

    @Column({
        nullable: true,
    })
    supplierName: string

    @Column()
    enteringStats: boolean

    @Column()
    special: boolean

    @Column()
    enteringToken: boolean

    @Column({
        nullable: true,
    })
    registeredWithoutPromo: boolean

    @Column()
    tgName: string
}
