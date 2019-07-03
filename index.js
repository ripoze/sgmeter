const noble = require('noble')
const async = require('async')
var fs = require('fs')
var webserver = require("./webserver")

process.on("uncaughtException", err => console.error(err))

var sensors=[]
var sensordata = readKnownTags()
sensordata.forEach(sensor=>{
    sensors.push({data:sensor})
})

var settings = {
    scanTime: 7000,
    readTime: 4000,
    idleTime: 60000
}
settings=readSettings()

scanProcess()
function scanProcess() {
    startScanning(settings.scanTime, () => {
        console.log("scanned")
        async.mapSeries(sensors, (sensor, callback) => {
            console.log("reading : " + sensor.data.id)
            readNRFvalues(settings.readTime, sensor.peripheral, () => callback())
        }, () => {
            console.log("sleeping " + settings.idleTime)
            setTimeout(() => {
                console.log("slept")
                scanProcess()
            }, settings.idleTime)
        })
    })
}

const onDiscover = (peripheral) => {
    if (peripheral.advertisement.localName == 'SENSOR') {
        if (sensors.filter(t => t.data.id == peripheral.id).length == 0) {
            sensors.push({ peripheral: peripheral, data: { id: peripheral.id, data: {}, calibration: [{ "kulma": 0, "sg": 1.01, "og": 1.09 }, { "kulma": 20, "sg": 1.02 }, { "kulma": 45, "sg": 1.06 }, { "kulma": 80, "sg": 1.08 }] } })
            console.log('nRF51 sensor added (' + peripheral.id + ")")
        }
        else {
            sensors.forEach(sensor=>{
                if(peripheral.id==sensor.data.id){
                    sensor.peripheral=peripheral
                }
            })
        }
    }
}

const readNRFvalues = (readTime, peripheral, callback) => {
    peripheral.connect(function (error) {
        if (error) console.log(error)
        peripheral.discoverServices([], function (error, services) {
            if (error) console.log(error)
            services[2].discoverCharacteristics([], function (error, characteristics) {
                characteristics[0].on('data', (data, isNotification) => {
                    sensors.filter(t => t.data.id == peripheral.id)[0].data.data.kulma = data.readInt16BE(4) / 256 / 60.5 * 90
                })
                characteristics[3].on('data', (data, isNotification) => {
                    sensors.filter(t => t.data.id == peripheral.id)[0].data.data.lampo = data.readInt16BE() / 10
                })
                characteristics[0].subscribe(error => { })
                characteristics[3].subscribe(error => { })
            })
        })
        setTimeout(() => {
            peripheral.disconnect()
            sensor = sensors.filter(s => s.data.id == peripheral.id)[0]
            callback()
        }, readTime)
    })
}

setInterval(() => {
    sensors.forEach(sensor => {
        sensor.data.data.sg = linearInterpolation(sensor.data.calibration, sensor.data.data.kulma)
        sensor.data.data.abv = (Number(sensor.data.calibration[0].og) - Number(sensor.data.data.sg)) * 131.25
    })
}, 1000)
//Skannaus käyntiin
noble.on('discover', onDiscover)

// start scanning
function startScanning(scanTime, callback) {
    processState = 0
    if (noble.state === 'poweredOn') {
        noble.startScanning([], true)
    }
    else {
        noble.once('stateChange', () => {
            noble.startScanning([], true)
        })
    }
    setTimeout(() => {
        noble.stopScanning()
        callback()
    }, scanTime)
}

webserver.begin(80, sensors, settings)

function readKnownTags() {
    var contents = fs.readFileSync('./sensors.json', 'utf8')
    var sensors = JSON.parse(contents)
    sensors.forEach(t => t.data = {})
    return sensors
}

function readSettings() {
    var contents = fs.readFileSync('./settings.json', 'utf8')
    var settings = JSON.parse(contents)
    return settings
}

function linearInterpolation(arr, value) {
    function compare(a, b) {
        if (a.kulma < b.kulma) return -1
        if (a.kulma > b.kulma) return 1;
        return 0;
    }

    arr.sort(compare);
    if (value < arr[0].kulma) return arr[0].sg
    if (value > arr[arr.length - 1].kulma) return arr[arr.length - 1].sg
    for (i = 0; i < arr.length; i++) {
        if (value < arr[i].kulma) {
            var d_kulma = arr[i - 1].kulma - arr[i].kulma
            var d_sg = arr[i - 1].sg - arr[i].sg
            return (value - arr[i - 1].kulma) * d_sg / d_kulma + arr[i - 1].sg
        }
    }
}