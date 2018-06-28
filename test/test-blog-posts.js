'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {Restaurant} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedPostData() {
  console.info('seeding blog post data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generatePostData());
  }
  //this will return a promise
  return Post.insertMany(seedData);
}

//used to generate data to put in db
function generateTitle() {
  const titles = [
  'A Very Cool Blog Post', 'NotSoCoolPost', 'Testing 1, 2, 3'];
  return titles[Math.floor(Math.random() * titles.length)];
}



// generate an object represnting a blog post.
// can be used to generate seed data for db
// or request.body data
function generatePostData() {
  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    title: generateTitle(),
    content: faker.lorem.sentences(),
  };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('Posts API resource', function() {
  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedPostData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedPostData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing posts', function() {
        // strategy:
        //    1. get back all posts returned by by GET request to `/posts`
        //    2. prove res has right status, data type
        //    3. prove the number of posts we got back is equal to number
        //       in db.
        //
        // need to have access to mutate and access `res` across
        // `.then()` calls below, so declare it here so can modify in place
        let res;
        return chai.request(app)
          .get('/posts')
          .then(function(_res) {
            // so subsequent .then blocks can access response object
            res = _res;
            expect(res).to.have.status(200);
            expect(res.body.posts).to.have.lengthOf.at.least(1);
              return Posts.count();
          })
          .then(function(count) {
            expect(res.body.posts).to.have.lengthOf(count);
          });
      });
  });
});
 






















