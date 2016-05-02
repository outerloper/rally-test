Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function () {
        alert("Hello from App");
        console.log("App");
    }
});
