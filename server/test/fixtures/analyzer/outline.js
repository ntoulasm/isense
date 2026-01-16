let global = 5;

function f() {
    let aaaa = 2;
}

f = () => { 
    let x = 2;
};

// Ideal: ???
// $1 > ...
f(() => {
    let z = 10;
    return z;
});

class point {

    x;
    y;

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    // FIXME: Hover searches for 'x', should search for 'set x'
    // TODO: Display parameters in outline?
    set x(x) {
        x = 5;
    }

    get x() {
        // return this.x;
    }

    set y(y) {
        y = 10;
    }

    get y() {

    }

    computeMagnitude() {
        const magnitude = x * x + y * y;
        return magnitude;
    };

}

a().p = () => {

}

a.x = function() {

};

a(class {
    x;
    y;
});

// TODO: Implement tree view in the outline of objects?
// let obj = {
//     a: 2
// }