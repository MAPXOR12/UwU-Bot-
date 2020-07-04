const express      = require('express');
const bodyParser   = require('body-parser');
//const EventEmitter = require('events');
//const DBL          = require('dblapi.js');

class Server {
    constructor(sharder, mysql, cache, config){
        this.sharder = sharder;
        this.mysql = mysql;
        this.cache = cache;
        this.config = config;
        this.server = express();

        this.server.use(bodyParser.json());
        this.server.use(bodyParser.urlencoded({extended: false}));

        this.launch();
    }

    launch(){
        if(this.config.webhooks.topgg) this.server.post(this.config.webhooks.topgg.path, this._handleTOPGGVote.bind(this));
        if(this.config.webhooks.discordbotlist) this.server.post(this.config.webhooks.discordbotlist.path, this._handleDBLVote.bind(this));
        if(this.config.webhooks.kofi) this.server.post(this.config.webhooks.kofi.path, this._handlePatron.bind(this));
        this.server.post('/api/searchbm', this._searchBlackMarket.bind(this));
        this.server.post('/api/leaderboard', this._getLeaderboard.bind(this));
        this.server.post('/api/patrons', this._getPatrons.bind(this));

        this.server.listen(this.config.serverPort, () => {
            console.log(`[SERVER] Server running on port ${this.config.serverPort}`);
        });
    }

    async _handleTOPGGVote(req, res){
        if(this.config.serverAuth !== req.headers.authorization) return res.status(403).send('Unauthorized');
        
        if(req.body.user){
            this.sharder.sendTo(0, {
                _eventName: "vote", 
                vote: req.body,
                type: 'topgg'
            });
        }

        res.status(200).send('Successfully received vote!');
    }

    async _handleDBLVote(req, res){
        if(!req.headers['x-dbl-signature'] || this.config.serverAuth !== req.headers['x-dbl-signature'].split(' ')[0]) return res.status(403).send('Unauthorized');
        
        if(req.body.id){
            this.sharder.sendTo(0, {
                _eventName: "vote", 
                vote: {
                    user: req.body.id
                },
                type: 'dbl'
            });
        }

        res.status(200).send('Successfully received vote!');
    }

    async _handlePatron(req, res){
        // wow ko-fi doesn't support authorization headers...
        //if(this.config.serverAuth !== req.headers.authorization) return res.status(403).send('Unauthorized');

        if(req.body.data){
            this.sharder.sendTo(0, {
                _eventName: "donation", 
                data: req.body.data
            });
        }

        res.status(200).send();
    }

    async _searchBlackMarket(req, res){
        if(this.config.serverAuth !== req.headers.authorization) return res.status(403).send('Unauthorized');

        const listings = await this.mysql.query(`SELECT * FROM blackmarket WHERE itemName LIKE ? ORDER BY pricePer ASC LIMIT 50`, ['%' + req.body.input + '%']);
        
        res.status(200).send(listings);
    }

    async _getLeaderboard(req, res){
        if(this.config.serverAuth !== req.headers.authorization) return res.status(403).send('Unauthorized');

        const leaderboard = await this.cache.get('leaderboard');

        if(!leaderboard) return res.status(200).send(undefined);

        res.status(200).send(JSON.parse(leaderboard).leadersOBJ);
    }

    async _getPatrons(req, res){
        if(this.config.serverAuth !== req.headers.authorization) return res.status(403).send('Unauthorized');

        const patrons = await this.cache.get('patronsCache');

        if(!patrons) return res.status(200).send(undefined);

        res.status(200).send(JSON.parse(patrons));
    }
}

module.exports = Server;