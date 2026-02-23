let foo;

if(a) {
    foo = function(a, b) {
        return a + b;
    }
} else {
    foo = function(c, d) {
        return c - d;
    }
}


foo()
//^hover
