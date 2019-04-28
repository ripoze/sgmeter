var calibration = [{ "kulma": 0, "sg": 1.01 }, { "kulma": 20, "sg": 1.11 }, { "kulma": 45, "sg": 1.23 }, { "kulma": 80, "sg": 1.43 }]
var value = 1

console.log(linearInterpolation(calibration, value))

function linearInterpolation(arr, value) {
    function compare(a, b) {
        if (a.kulma < b.kulma) return -1
        if (a.kulma > b.kulma) return 1;
        return 0;
    }

    arr.sort(compare);
    console.log(arr)
    len=arr.length-1
    if(value<arr[0].kulma) return arr[0].sg
    if(value>arr[len].kulma) return arr[len].sg
    for (i = 0; i < arr.length; i++) {
        if (value < arr[i].kulma) {
            var d_kulma=arr[i-1].kulma-arr[i].kulma
            var d_sg=arr[i-1].sg-arr[i].sg
            return (value - arr[i-1].kulma)*d_sg/d_kulma + arr[i-1].sg
            break
        }
    }
}