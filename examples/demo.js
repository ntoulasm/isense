let global = 100;
function nonPure() {
    global;
    global = '';
}
nonPure();
global;

function add(a, b) {
    return a + b;
}

let x = add(1, 4);

function foo(a) {
    if(true) {
        a + 5;
    } else if(true) {
        let x = {a};
        x.a.y;
    }
}

function point(x, y) {

    const me = {};

    me.x = x;
    me.y = y;
    
    const sqrt = () => {};

    me.computeMagnitude = () => {
        return sqrt(me.x * me.x + me.y * me.y);
    }

    return me;

};

/*

    function foo(a) {
        a.b;
        a * 2;
    }

*/

/*

    function foo(a) {
        function foo2(b) {
            return b + 2;
        }
        return foo2(a); // number || string
    }

*/

/*

    // a: object { b: any }
    // a: object { b: number || string }
    function foo(a) { 
        a.b + 2;
    }

*/

/*

    function foo(a) {
        Math.sqrt(a); // a: number?
    }

*/


