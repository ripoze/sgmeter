const noble = require('noble')
var url = require('url')
var http = require('http')
var path = require('path')
var fs = require('fs')

process.on("uncaughtException", err => console.error(err))

var sensors = []
readKnownTags()

const onDiscover = (peripheral) => {
    if (peripheral.advertisement.localName == 'SENSOR') {
        noble.stopScanning();
        var msg = {}

        if (sensors.filter(t => t.id == peripheral.id).length == 0) {
            sensors.push({ id: peripheral.id, data: {}, calibration: [{ "kulma": 0, "sg": 1.01, "og":1.04 }, { "kulma": 20, "sg": 1.02 }, { "kulma": 45, "sg": 1.06 }, { "kulma": 80, "sg": 1.08 }] })
            console.log('nRF51 sensor added')


        } else {
            console.log('known sensor found')
        }
        readNRFvalues(peripheral)
        setInterval(() => { readNRFvalues(peripheral) }, 60000)
        setInterval(() => {
            sensors[0].sg = linearInterpolation(sensors[0].calibration, sensors[0].data.kulma)
            console.log("Kulma: " + Number(sensors[0].data.kulma).toFixed(2) + "\tLämpö: " + sensors[0].data.lampo + "\tSG: " + sensors[0].sg)
        }, 1000)
    }
}

const readNRFvalues = (peripheral) => {
    peripheral.connect(function (error) {
        if (error) console.log(error)
        peripheral.discoverServices([], function (error, services) {
            if (error) console.log(error)
            services[2].discoverCharacteristics([], function (error, characteristics) {

                characteristics[0].on('data', (data, isNotification) => {
                    sensors.filter(t => t.id == peripheral.id)[0].data.kulma = data.readInt16BE(4) / 256 / 60.5 * 90
                })
                characteristics[3].on('data', (data, isNotification) => {
                    sensors.filter(t => t.id == peripheral.id)[0].data.lampo = data.readInt16BE() / 10
                })
                characteristics[0].subscribe(error => { })
                characteristics[3].subscribe(error => { })
            })

        })
        setTimeout(() => { peripheral.disconnect() }, 55000)
    })
}




//Skannaus käyntiin
noble.on('discover', onDiscover)

// start scanning
if (noble.state === 'poweredOn') {
    noble.startScanning([], true)
}
else {
    noble.once('stateChange', () => {
        noble.startScanning([], true)
    })
}

webserver(80)

function webserver(port) {
    http.createServer(function (req, res) {
        var pathname = url.parse(req.url).pathname
        var params = url.parse(req.url, true).query
        var extname = path.extname(pathname)

        if (pathname === '/') pathname = '/index.html'

        var contentType = 'text/html'
        switch (extname) {
            case '.js':
                contentType = 'text/javascript'
                break
            case '.css':
                contentType = 'text/css'
                break
            case '.svg':
                contentType = 'image/svg+xml'
                break
        }


        if (req.method === 'GET' && pathname === '/kalibrointi') {
            console.log("kalibrointi query")
            console.log(params)
            
            sensors[0].calibration[0].kulma=Number(params.kulma1)
            sensors[0].calibration[1].kulma=Number(params.kulma2)
            sensors[0].calibration[2].kulma=Number(params.kulma3)
            sensors[0].calibration[3].kulma=Number(params.kulma4)
            sensors[0].calibration[0].sg=Number(params.sg1)
            sensors[0].calibration[1].sg=Number(params.sg2)
            sensors[0].calibration[2].sg=Number(params.sg3)
            sensors[0].calibration[3].sg=Number(params.sg4)
            sensors[0].calibration[0].og=Number(params.og)

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.write('<meta http-equiv="refresh" content="1; url=/" />');
            res.write("Saved")
            res.end()
            fs.writeFile("./sensors.json", JSON.stringify(sensors), err => console.log(err))
            return
        }
        if (req.method === 'GET' && pathname === '/data') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.write(JSON.stringify(sensors[0], null, '\t', 'latin1'))
            res.end()
            return
        }

        if (req.method === 'GET') {
            fs.readFile('./www' + pathname, 'utf8', function (err, data) {
                if (err) {
                    res.writeHead(404, 'Not Found')
                    res.end()
                } else {
                    res.writeHead(200, { 'Content-Type': contentType })
                    data = data.replace('__IP__', getIP())
                    res.write(data, 'utf8')
                    res.end()
                }
            })
            return
        }
    }).listen(port)
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

function readKnownTags() {
    var contents = fs.readFileSync('./sensors.json', 'utf8')
    console.log(contents)
    sensors = JSON.parse(contents)
    sensors.forEach(t => t.data = {})
}


function linearInterpolation(arr, value) {
    function compare(a, b) {
        if (a.kulma < b.kulma) return -1
        if (a.kulma > b.kulma) return 1;
        return 0;
    }

    arr.sort(compare);
    len = arr.length - 1
    if (value < arr[0].kulma) return arr[0].sg
    if (value > arr[len].kulma) return arr[len].sg
    for (i = 0; i < arr.length; i++) {
        if (value < arr[i].kulma) {
            var d_kulma = arr[i - 1].kulma - arr[i].kulma
            var d_sg = arr[i - 1].sg - arr[i].sg
            return (value - arr[i - 1].kulma) * d_sg / d_kulma + arr[i - 1].sg
            break
        }
    }
}