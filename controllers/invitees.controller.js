import { generateUsername } from "unique-username-generator";
import { getInvitee, getInvitees, createInvitee } from "../models/invitees.model.js";
import { isArrEmpty, isObjEmpty } from "../models/invitees.model.js";


async function createNewInvitee(formBody) {
    
    try {
        
        if(dataCreateInviteeValid(formBody)) {
            const firstName = formBody.firstName;
            const lastName = formBody.lastName;
            const email = formBody.email;


            const result = await createInvitee(firstName, lastName, email);


            return result;
            
        }
        throw new Error('Form data is wrong or nonexistant');
    }catch (error){
        if(error.code === 'ER_DUP_ENTRY') {
            throw error;
        }
        else {
            return null;
        }
    }

}

async function retrieveInvitee(data) {
    try {
        if(dataSelectInviteeValid(data)){
            const invitee = await getInvitee(data.id);
            if(invitee != null) {
                return invitee;
            }
            throw new Error('Could not find Invitee');
        }
        throw new Error('Form Data Invalid');
    } catch (error) {
        throw error;
    }
}



async function retrieveAllInvitees() {
    try {
        const invitees = await getInvitees();
        if(invitees!= null) {
            return invitees;
        }
        throw new Error('Could not get Invitees');
    } catch(error) {
        throw error;
    }
}

function dataSelectInviteeValid(data) {
    if(data.id === null) {
        //console.log('null/undefined');
        return false;
    }
    if(isObjEmpty(data)) {
        //console.log('No Obj');
        return false;
    }
    if(!data.hasOwnProperty('id')) {
        //console.log('No id Field');
        return false; 
    }
    if(isNaN(data.id)) {
        //console.log('NaN');
        return false;
    }
    if(data.id < 0) {
        //console.log('negative');
        return false;
    }
    return true
}

function dataCreateInviteeValid(data) {

    if(data.firstName === null || 
        data.lastName === null || 
        data.email === null) {
            console.log('test1');
            
        return false;
    }
    
    if(isObjEmpty(data)) {
        return false
    }
    if(!data.hasOwnProperty('firstName') ||
            !data.hasOwnProperty('lastName') ||
            !data.hasOwnProperty('email')
    ) {
        console.log('test2');
        
            return false;
    }

    if(!typeof data.firstName === 'string' ||
        !typeof data.lastName === 'string' ||
        !typeof data.email === 'string'
    ) {
       console.log('test3');
        
        return false;
    }


    if(!data.firstName.length > 0 ||
    !data.lastName.length > 0 ||
    !data.email.length > 0
    )
        {
            console.log('test4');
               
            return false
        }
    
    return true;
}

export {
    createNewInvitee,
    retrieveAllInvitees,
    retrieveInvitee
}