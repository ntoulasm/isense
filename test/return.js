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