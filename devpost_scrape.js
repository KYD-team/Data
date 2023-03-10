const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function fetchData(url) {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching data for ${url}: ${error.message}`);
  }
}


async function getProjectLinks(pageUrl) {
  const $ = await fetchData(pageUrl);
  const projectLinks = [];

  $('.gallery-item').each((i, element) => {
    const projectLink = $(element).find('a.block-wrapper-link').attr('href');
    projectLinks.push(projectLink);
  });

  return projectLinks;
}

async function scrapeProjects(searchUrl) {
  const allProjects = [];

  for (let i = 1; i <= 50; i++) {
    const searchUrl = `https://devpost.com/software/search?page=${i}&query=is%3Awinner`;
    console.log(`Scraping page ${i}...`);

    const projectLinks = await getProjectLinks(searchUrl);

    const projects = await Promise.all(
      projectLinks.map(async (projectLink) => {
        const projectData = await getProjectData(projectLink);
        return projectData;
      })
    );
    allProjects.push(...projects);
  }
    
  const jsonData = {
    projects: allProjects,
    total: allProjects.length,
  };
  
  const devpostMap = {
    projects: {},
    users: {},
  }
  allProjects.forEach((project) => {
    const {githubUrl, participants, fullName} = project;

    if (githubUrl) {
      devpostMap.projects[fullName] = githubUrl;
    }

    if (participants) {
      participants.forEach((participant) => {
        if (participant.github) {
          devpostMap.users[participant.github] = participant.github;
        }
      })
    }
  })

  console.log(devpostMap)
  saveData(jsonData, 'devpostProjects.json');
  saveData(devpostMap, 'devpostMap.json');
  return jsonData;
}

async function getProjectData(link) {
  const url = link;
  console.log(`Getting data for project ${url}`);
  let data = null;
  let projectData = {};

  try {
    const result = await axios.get(url);
    data = result.data;
  } catch (error) {
  }
  
  if (data) { 
    const $ = cheerio.load(data);
    
    const githubUrl = $('a[href*="github.com"]').attr('href');
    const pathParts = githubUrl?.replace("https://github.com/", "").split("/");
    const repoName = pathParts?.slice(0, 2).join("/");

    projectData = {
      githubUrl,
      fullName: repoName,
      participants: [],
    };

    $('.software-team-member')?.each((i, elem) => {
      const profileLink = $(elem).find('a').attr('href');
      const imageUrl = $(elem).find('img').attr('src');
      projectData.participants.push({ profileLink, imageUrl });
    });

    const usersData = await Promise.all(
      projectData.participants?.map(async (user) => {
        const copyUser = {...user}

        if (copyUser.profileLink) {
          let data = null;
          try {
            const result = await axios.get(copyUser.profileLink);
            data = result.data;
          } catch (error) {
          }

          if (data) {
            const $ = cheerio.load(data);
            const githubUrlUser = $('a[href*="github.com"]').attr('href');
  
            if (githubUrlUser?.length) {
              const githubUsername = githubUrlUser.split('/').pop();
              const name = $('#portfolio-user-name').text().trim();
              copyUser['github'] = githubUsername;
              copyUser['name'] = name;
            }
          }
        }

        return copyUser;
      })
    );

    projectData.participants = usersData  
  }
  
  return projectData;
}

function saveData(data, fileName) {
  const jsonContent = JSON.stringify(data, null, 2);

  fs.writeFile(fileName, jsonContent, "utf8", function (err) {
    if (err) {
      console.log("An error occurred while writing JSON Object to File.");
      console.log(err);
    } else {
      console.log("JSON file has been saved.");
    }
  });
}

scrapeProjects('https://devpost.com/software/search?query=is%3Awinner')
  .then(console.log("done"))
  .catch(console.error);
