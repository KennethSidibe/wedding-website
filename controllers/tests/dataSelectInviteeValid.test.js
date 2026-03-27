import { dataSelectInviteeValid } from "../invitees.controller";

test('Data Selection Invitee Valid Test',  () => {
    expect(dataSelectInviteeValid({})).toBeFalsy();
    expect(dataSelectInviteeValid([])).toBeFalsy();
    expect(dataSelectInviteeValid({id:null})).toBeFalsy();
    expect(dataSelectInviteeValid({id:undefined})).toBeFalsy();
    expect(dataSelectInviteeValid({firstName:'ken'})).toBeFalsy();
    expect(dataSelectInviteeValid({id:'1'})).toBeFalsy();
    expect(dataSelectInviteeValid({id:-1})).toBeFalsy();
    expect(dataSelectInviteeValid({id:100})).toBeTruthy();
});
