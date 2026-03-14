import { pool } from "../database/connection.js";
import { generateUsername, generateFromEmail } from "unique-username-generator";
import { TEST_TABLE_NAME, PROD_TABLE_NAME } from "./queries/invitees.queries.js";

const TABLE_NAME = TEST_TABLE_NAME;

async function getInvitees() {
    const query = `SELECT * FROM ${TABLE_NAME} limit 100`;
    
    try {
        const [rows, fields] = await pool.execute(query);
    
        if(!(Array.isArray(rows) && rows.length == 0)) {
            return rows;
        }
        throw new Error('Cannot get Invitees, Data is empty or wrong');
    } catch(error) {
        console.log(error);
        return null
    }
    
}

const isArrEmpty = (arr) => !arr instanceof Array || !arr.length;

function isObjEmpty (obj) {

    return obj == null 
        || Boolean(obj 
        && typeof obj === 'object') 
        && !Object.keys(obj).length;
}

async function getInvitee(id) {
    
    console.log(`ID : ${id}`);
    

    try {
        const query = `SELECT * FROM ${TABLE_NAME} where id = ?`;
        const [data, fields] = await pool.execute(query, [id]);
        
        if(!isObjEmpty(data)) {
            const [invitee] = data;
            return invitee;
        }
        return null;
    } catch (error) {
        throw error;
    }
}

async function createInvitee(fName, lName, email) {

    try {
        const query = `INSERT INTO ${TABLE_NAME} (fName, lName, email) VALUES (?, ?, ?)`;

        const [result, fields] = await pool.execute(query, [fName, lName, email]);

        
        console.log(`createInvitee result:`);
        console.log(result);
        console.log(`Fields:`);
        console.log(fields);

        if(!isObjEmpty(result)) {
            const newId = result.insertId;

            console.log(`new Id inserted : ${newId}`);
            
            return newId;
        }
        throw new Error('Cannot create Invitee, Data is empty or wrong');
    } catch (error) {
        throw error;
    }
}

async function deleteInvitee(id) {
    try {
        const query = `DELETE FROM ${TABLE_NAME} where id = ?`;
        if(isNaN(id)) throw new TypeError;
        
        const [result, fields] = await pool.execute(query, [id]);
        if(!isObjEmpty(result)) {
            console.log(result);
            if(result.affectedRows > 0) {
                return result;
            }
            throw new Error ('No Invitee were deleted');
        }

        throw new Error('Cannot delete Invitee');
    } catch (error) {
        throw error
    }
}

async function updateInviteeName(id, fName, lName) {
    try {
        const query = `UPDATE ${TABLE_NAME} 
        SET 
        fName = ?,
        lName = ?
        WHERE id = ?`;
        if(isNaN(id)) throw new Error('Id is not a number or incorrect val');

        console.log(`id : ${id}, fName: ${fName}, ${lName}`);
        console.log(`type of, fName ${typeof fName}, lName ${typeof lName}`);
        
        // check if fName & lName are string
        if(!typeof fName === "string" && !typeof lastName === "string") {
            throw new Error('fName or lName is not a string');
        }
        
        const [result, fields] = await pool.execute(query, [fName, lName, id]);
        if(!isObjEmpty(result)) {
            if(result.affectedRows > 0) {
                return result;
            }
            throw new Error ('No Invitee were updated');
        }

        throw new Error('Cannot update Invitee');
     } catch (error) {
        throw error;
     }
}

export {
    getInvitee,
    getInvitees,
    createInvitee,
    deleteInvitee,
    updateInviteeName,
    isArrEmpty,
    isObjEmpty
}