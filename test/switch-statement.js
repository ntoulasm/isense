let global = 100;

switch(a) {
    case 1:
        global = 2;
        break;
    case 2: {
        if(b) {
            global = 5;
        }
        break;
    }
    case (global = 6): break;
    default: break;
}

global;