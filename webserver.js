var mustacheExpress = require('mustache-express');
var bodyParser = require("body-parser")
const express = require('express')
//var cors = require('cors')
const app = express()

var http = require('http')
var url = require('url')
var path = require('path')
var fs = require('fs')

module.exports = {
    begin: function (port, sensors, settings) {
        //webserver
        app.engine('html', mustacheExpress())
        app.set('view engine', 'html')
        app.set('views', 'www')
        app.use(express.static('www/static'))
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(bodyParser.json());
        //app.use(cors())

        sensorData = {}

        function generateMainPage() {
            var sdata = ''
            sdata += '<div class="col-xs-9 text-center">\n'
            sdata += '<font size=4 face="verdana">\n'
            sdata += '<table class="table">\n'
            sdata += '<thead class="thead-dark"><tr><th>Anturi</th><th>Lämpö</th><th>Kulma</th><th>SG</th><th>ABV</th><th>Kalibrointi</th></tr></thead>\n'
            sensors.forEach((sensor) => {
                sdata += '<tr>\n'
                sdata += '<td>' + sensor.data.nimi || sensor.data.id + '</td>\n'
                sdata += '<td id="' + sensor.data.id + '_lampo">' + sensor.data.data.lampo + '</td>\n'
                sdata += '<td id="' + sensor.data.id + '_kulma">' + sensor.data.data.kulma + '</td>\n'
                sdata += '<td id="' + sensor.data.id + '_sg">' + sensor.data.data.sg + '</td>\n'
                sdata += '<td id="' + sensor.data.id + '_og">' + sensor.data.data.abv + '</td>\n'
                sdata += '<td><a href="/kalibrointi?sensor=' + sensor.data.id + '"><button type="button" class="btn"><span class="glyphicon glyphicon-cog"></span></button></a></td>\n'
                //sdata += '<td><button class="btn btn-success></button></td>\n'
                sdata += '</tr>\n'

            })
            sdata += '</table>\n'
            sdata += '</font>\n'
            sdata += '</div>\n'
            return sdata
        }

        app.get('/', function (req, res) {
            res.render('index.html', { sensors: generateMainPage(), ip: getIP() })
        })

        app.get('/kalibrointi', function (req, res) {
            sensor = sensors.filter(s => s.data.id == req.query.sensor)[0].data
            res.render('kalibrointi.html', { id: sensor.id })
        })

        app.get('/asetukset', function (req,res) {
            res.render('asetukset.html', settings)
        })

        app.post('/asetukset', function (req,res){
            settings.idleTime=Number(req.body.idleTime) || 7000
            settings.scanTime=Number(req.body.scanTime) || 4000
            settings.readTime=Number(req.body.readTime) || 60000
            fs.writeFile("./settings.json", JSON.stringify(settings), err => console.log(err))
            res.send('<meta http-equiv="refresh" content="0; url=/" />')
        })

        app.post('/kalibrointi', function (req, res) {
            sensors.forEach(sensor => {
                if (sensor.data.id == req.body.mac) {
                    sensor.data.nimi = req.body.nimi
                    sensor.data.calibration[0].kulma = Number(req.body.kulma1)
                    sensor.data.calibration[1].kulma = Number(req.body.kulma2)
                    sensor.data.calibration[2].kulma = Number(req.body.kulma3)
                    sensor.data.calibration[3].kulma = Number(req.body.kulma4)
                    sensor.data.calibration[0].sg = Number(req.body.sg1)
                    sensor.data.calibration[1].sg = Number(req.body.sg2)
                    sensor.data.calibration[2].sg = Number(req.body.sg3)
                    sensor.data.calibration[3].sg = Number(req.body.sg4)
                    sensor.data.calibration[0].og = Number(req.body.og)
                }
            })
            fs.writeFile("./sensors.json", JSON.stringify(sensors.map((s) => s.data)), err => console.log(err))
            res.send('<meta http-equiv="refresh" content="0; url=/" />')
        })

        app.get('/reset', function (req, res){
            sensors=[]
            fs.writeFile("./sensors.json", "[]", err => console.log(err))
            res.send('<meta http-equiv="refresh" content="0; url=/" />')
        })
        app.get('/data', function (req, res) {
            res.json(sensors.map((s) => s.data))
        })

        app.listen(port)
    }
}

function getIP() {
    var interfaces = require('os').networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && address.address !== '127.0.0.1' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    var msg = addresses.map(n => n + " ")
    if (addresses.length > 0) return (msg)
    else return ""
}
