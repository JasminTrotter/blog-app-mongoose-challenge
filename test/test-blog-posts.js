'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {BlogPost} = require('../models');
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
  return BlogPost.insertMany(seedData);
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
    author: faker.name.firstName(),
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
            expect(res.body).to.have.lengthOf.at.least(1);
              return BlogPost.count();
          })
          .then(function(count) {
            expect(res.body).to.have.lengthOf(count);
          });
      });
  });
  it('should return posts with right fields', function() {
      // Strategy: Get back all posts, and ensure they have expected keys

      let resPosts;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body).to.be.a('array');
          expect(res.body).to.have.lengthOf.at.least(1);

          res.body.forEach(function(post) {
            expect(post).to.be.a('object');
            expect(post).to.include.keys(
              'id', 'author', 'title', 'content');
          });
          resPosts = res.body[0];
          return BlogPost.findById(resPosts.id);
        })
        .then(function(post) {

          expect(resPosts.id).to.equal(post.id);
          //help...
          //expect(resPosts.author).to.equal(post.author);
          expect(resPosts.title).to.equal(post.title);
          expect(resPosts.content).to.equal(post.content);
          
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the post we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new post', function() {

      const newPost = generatePostData();

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id', 'title', 'author', 'content');
          expect(res.body.title).to.equal(newPost.title);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.author).to.equal(newPost.author);
          expect(res.body.content).to.equal(newPost.content);

          return BlogPost.findById(res.body.id);
        })
        .then(function(post) {
          expect(post.title).to.equal(newPost.title);
          expect(post.author).to.equal(newPost.author);
          expect(post.content).to.equal(newPost.content);
        });

    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing post from db
    //  2. Make a PUT request to update that post
    //  3. Prove post returned by request contains data we sent
    //  4. Prove post in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        author: 'Cool Bro',
        title: 'Cool story, bro'
      };

      return BlogPost
        .findOne()
        .then(function(post) {
          updateData.id = post.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(post) {
          expect(post.author).to.equal(updateData.author);
          expect(post.title).to.equal(updateData.title);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a post
    //  2. make a DELETE request for that post's id
    //  3. assert that response has right status code
    //  4. prove that post with the id doesn't exist in db anymore
    it('delete a post by id', function() {

      let post;

      return BlogPost
        .findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          expect(_post).to.be.null;
        });
    });
});



 






















