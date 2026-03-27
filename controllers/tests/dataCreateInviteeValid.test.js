import { dataCreateInviteeValid } from "../invitees.controller.js";

test('Validate form input data create user', async() => {
    expect(await dataCreateInviteeValid({})).toBeFalsy();
    expect(await dataCreateInviteeValid([])).toBeFalsy();
    expect(await dataCreateInviteeValid({okay:''})).toBeFalsy();
    expect(await dataCreateInviteeValid({lastName:'sidi', email:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'sidi', email:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'sidi', lastName:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:null, lastName:null, email:null})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'null', lastName:'null', email:null})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'null', lastName:null, email:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:null, lastName:'null', email:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:null, lastName:'null', email:'sidibekenstevea@gmail.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'', lastName:'', email:''})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'null', lastName:'null', email:'null@null.com'})).toBeFalsy();
    expect(await dataCreateInviteeValid({firstName:'ken', lastName:'sidi', email:'sidibekenstevea@gmail.com'})).toBeTruthy();
},
10000);