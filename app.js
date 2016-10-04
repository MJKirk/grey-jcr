/* REQUIREMENTS*/
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var passport = require('passport');
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var LocalStrategy = require('passport-local').Strategy;
var https = require('https');
var pgp = require('pg-promise')();
var compress = require('compression');
var helmet = require('helmet');

var routes = require('./routes/index');
var admin = require('./routes/admin/index');

var app = express();

/* SET UP */
require('dotenv').config();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// db set up
var db = pgp({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

var User = require('./models/user');
var Folder = require('./models/folder')

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    store: new redisStore({host: process.env.REDIS_HOST, port: process.env.REDIS_PORT}),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'semantic/dist')));

// Authentication setup
passport.serializeUser(function (user, done) {
  done(null, user.username);
});

passport.deserializeUser(function (username, done) {
    var current_user = null;
    User.findByUsername(username).then(function(user){
        current_user = user;
        return current_user.getRoles();
    }).then(function(roles) {
        return Promise.all(
            roles.map(function(role) {
                return Folder.findForRole(role.id).then(function(folder) {
                    role.folder = folder;
                    return role;
                });
            })
        )
    }).then(function(roles) {
        current_user.level = 0;
        for (var i = 0; i < roles.length; i++) {
            if (roles[i].level > current_user.level) {
                current_user.level = roles[i].level;
            }
        };
        current_user.roles = roles;
        done(null, current_user);
    }).catch(function (err) {
        return done(err);
    });
});

passport.use(new LocalStrategy( function (username, password, done) {
    // Check username and password are set
    if (!password || !username) return done(null, false);
    var username = username.toLowerCase();

    // authorize user
    User.authorize(username, password)
        .then(function() {
            User.findByUsername(username).then(function(user) {
                done(null, user)
            }).catch(function(err) {
                return User.create(username);
            }).then(function(user) {
                done(null, user)
            }).catch(function(err) {
                done(err);
            });
        })
        .catch(function(err) {
            done(null, false);
        });
}));

var prettydate = require('pretty-date');
app.use(function (req, res, next) {
  // Sets some things for all requests things
  req.db = db;
  res.locals.user = req.user;
  res.locals.query = req.query;
  res.locals.prettydate = prettydate;
  next();
});

/* ROUTING */
app.use('/', routes);
app.use('/admin/', admin);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// super admin error handler
// will print stacktrace
app.use(function(err, req, res, next) {
  if (true) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  } else {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: {}
    });
  }
});

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.toLowerCase().slice(1);
}

module.exports = app;
