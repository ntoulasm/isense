function f1(b) {
    if (b == true) return 'f1';
    return { flag : b };
}
function f2(a,b) {
    if (a+b == 20) return f1;
    if (b == -1) return [1,2];
    return { x : a, y : b };
}
let z = f1(false);
z = f2(10,10);

function get2(a) {
    return {
        a: 2
    };
    let x = 2;
    let y = 5 + x;
    return 5;
    x = 100;
    return 100;

}
let x = get2();
x.b = 5;
(((x.c))) = 10;
(x) = 10;;

let zoo = {
    x,
    a: get2()
};

let global = 5;

function foo() {
    global = get2();
}

global;
