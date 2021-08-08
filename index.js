const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const validate = require("validate.js");

const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: "./database.sqlite"
    },
});


const bookshelf = require('bookshelf')(knex);


const app = express();
let data = [];



app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
    return res.json({
      message: 'Welcome to BackEndDev',
    });
});

var storage = multer.memoryStorage();
var upload = multer({ 
    storage: storage,
    fileFilter : function(req, file, callback) {
        if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length-1]) === -1) {
            return callback(new Error('Wrong extension type'));
        }
        callback(null, true);
    }
}).single('file');

app.post('/upload', function(req, res) {
    upload(req, res, function(err){
        if(err){
            res.json({error_code:1,err_desc:err});
            return;
        }
        /** Multer gives us file info in req.file object */
        if(!req.file){
            res.json({error_code:1,err_desc:"No file passed"});
            return;
        }
        const workbook = xlsx.read(req.file.buffer, {type:'buffer'});
        const sheet_name_list = workbook.SheetNames;
        const sheet = sheet_name_list[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet],{'raw':true});

        const constraints = {
            "Names": {
                presence: true,
                length: {minimum: 3}
            },
            "NID": {
                presence: true,
                format: {
                    pattern: "[0-9]{16}",
                    message: "^NID Number must be 16 digits"
                },
                length: {
                    is: 16,
                    message: "^NID Number must be 16 digits"
                }
            },
            "phone number": {
                presence: true,
                format: {
                    pattern: "07[238][0-9]{7}",
                    message: "^Phone Number must be in the format 07xxxxxxxx"
                },
                length: {
                    is: 10,
                    message: "^Phone Number must be 10 digits"
                },
            },
            "gender": {
                presence: true,
                inclusion: {
                    within: ['F', 'M'],
                    message: "^Gender must be either M or F"
                }
            },
            "email": {
                presence: true,
                email: true
            }
        };
        
        data.forEach((row) => {
            const errors = validate(row, constraints, {format: "flat"});
            if(errors) row['validation errors'] = errors.join(', ');
            else row['validation errors'] = '';
        });
        

        res.sendStatus(200);
    });
});

app.get('/records', (req, res) => {
    page_number = req.params.page || 1;
    page_size = req.params.limit || 50;
    if(page_number < 1) page_number = 1; // page number starts at 1
    if(page_size < 1) page_size = 50;
    res.json(data.slice((page_number - 1) * page_size, page_number * page_size));
});

// Defining models
const User = bookshelf.model('User', {
    tableName: 'users',
    idAttribute: 'id'

});

async function save_users() {
    for (let row of data){
        let user = Object.assign({}, row);
        user['phone_number'] = user['phone number'];
        delete user['phone number'];
        delete user['validation errors'];
        try {
            await new User(user).save();
        }
        catch(e) {
            console.log(`Failed to save data: ${e}`);
            throw e;
        }
    }
}

app.post('/users', (req, res) => {
    save_users()
    .then(() => {
        res.sendStatus(201);
    })
    .catch((err) => {
        res.status(500).send(`Failed to save data: ${err}`);
    });
});

  //port definition
const port = process.env.PORT || 5000;

app.listen(port, async () => {
    console.log(`Server started on port ${port}`);
    await knex.raw('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY,Names TEXT, NID TEXT, phone_number TEXT, gender TEXT, email TEXT);');
});

