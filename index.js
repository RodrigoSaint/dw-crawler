const fs = require("fs");
const cheerio = require("cheerio");
const { default: axios } = require("axios");

const basePath = "https://learngerman.dw.com";

function crawlLesson(url) {
  return axios
    .get(encodeURI(`${basePath}${url}`))
    .then((c) => cheerio.load(c.data))
    .then(($) =>
      $(".col-sm-12[data-lesson-id]")
        .map((_, element) => {
          const lessonDom = cheerio.load(element);
          return {
            id: lessonDom("a").attr("data-lesson-id"),
            title: lessonDom("h3").text(),
            description: lessonDom("p:eq(0)").text(),
            url: lessonDom("a").attr("href"),
          };
        })
        .toArray()
        .slice(0, -1)
    );
}

function removeSpaces(text) {
  return text.replace(/\n/g, "");
}

function crawlLessonVocabulary(lesson) {
  return axios(encodeURI(`${basePath}${lesson.url}/lv`))
    .then(({ data }) => cheerio.load(data))
    .then(($) =>
      $(".vocabulary")
        .map((_, element) => {
          const vocabularyDom = cheerio.load(element);
          return {
            image:
              vocabularyDom(".vocabulary-entry img").attr("src") || undefined,
            native: {
              text: removeSpaces(
                vocabularyDom(".vocabulary-entry:eq(2)").text()
              ),
            },
            target: {
              text: removeSpaces(
                vocabularyDom(".vocabulary-entry:eq(0)").text()
              ),
            },
          };
        })
        .toArray()
    )
    .catch((error) => {
      console.log(`Failed to get ${basePath}${lesson.url}/lv`);
      throw error;
    });
}

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

function crawCourse(language) {
  return axios(`${basePath}/${language}/overview`)
    .then((c) => cheerio.load(c.data))
    .then(($) =>
      $("a.main-course-container")
        .map((_, element) => {
          const courseDom = cheerio.load(element);
          return {
            title: courseDom(".course-title").text(),
            description: courseDom("p").text(),
            level: courseDom("h2").text().trim(),
            url: element.attribs.href,
          };
        })
        .toArray()
        .filter((c) => c.level)
    );
}

crawCourse("pt-br")
  .then(async (courseCollection) => {
    for (const course of courseCollection) {
      const lessonCollection = await crawlLesson(course.url);
      course.lessonCollection = lessonCollection;
      for (const lesson of lessonCollection) {
        console.log(
          `Fetching lesson ${lessonCollection.indexOf(lesson)} of ${
            lessonCollection.length
          } from course ${courseCollection.indexOf(course)} of ${
            courseCollection.length
          }`
        );
        lesson.flashcardCollection = await crawlLessonVocabulary(lesson);
        await wait();
      }
    }
    return courseCollection;
  })
  .then((result) => fs.writeFileSync("./result.json", JSON.stringify(result)));
