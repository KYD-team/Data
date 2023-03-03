const axios = require('axios');
const fs = require('fs');

const searchQuery = "Submitted for verification at snowtrace";
const apiEndpoint = "https://api.github.com/search/code";
const accessToken = "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";

const perPage = 1000;
const page = 1;

const requestOptions = {
  headers: {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "my-github-script",
  },
};

const searchUrl = `${apiEndpoint}?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`;
//const searchUrl = `${apiEndpoint}?q=${encodeURIComponent(searchQuery)}`;

async function fetchCommits(url) {
  const res = await axios.get(url, requestOptions);
  return res.data.map((event) => event.created_at.split('T')[0]);
}
async function fetchRepoCommits(repoUrl) {
  const res = await axios.get(`${repoUrl}/commits`, requestOptions);
  return res.data.map((commit) => commit.commit.author.date.split('T')[0]);
}
async function fetchData() {
  const { data } = await axios.get(searchUrl, requestOptions);

  const ownerMap = {};
  const owners = {};
  const users = [];
  const orgs = [];
  const other = [];
  const res = [];
  const userCommits = {};
  const repoCommits = {};  

  console.log("data.items.length")
  console.log(data.items.length)

  for (let i = 0; i < data.items.length; i++) {
    const { repository, html_url } = data.items[i];
    const { name, owner, url, full_name } = repository;
    const { login } = owner;

    if (!ownerMap[login]) {
      ownerMap[login] = await axios.get(owner.url, requestOptions);
    }

    if (!owners[login]) {
      owners[login] = {
        count: 1,
        [name]: 1,
      };
    } else {
      if (owners[login][name]) {
        owners[login][name] = owners[login][name] + 1;
      } else {
        owners[login].count = owners[login].count + 1;
        owners[login][name] = 1;
      }
    }

    if (owners[login][name] == 1) {
      const repoObj = {
        url: html_url,
        fullName: full_name,
        name,
        owner: owner.login,
        ownerId: owner.id,
        ownerUrl: owner.url,
        ownerAvatar: owner.avatar_url,
        ownerTwitter: ownerMap[login].data.twitter_username,
        ownerCompany: ownerMap[login].data.company,
        type: owner.type,
        created_at: "",
        updated_at: "",
      };
      const repoRes = await axios.get(url, requestOptions);
      repoObj.created_at = repoRes.data.created_at.split('T')[0];
      repoObj.updated_at = repoRes.data.updated_at.split('T')[0];

      const eventsUrl = ownerMap[login].data.received_events_url.replace(
        "{/privacy}",
        ""
      );

      repoCommits[full_name] = await fetchRepoCommits(repoRes.data.url);

      userCommits[owner.login] = await fetchCommits(
        `${eventsUrl}?per_page=1000&repo=${owner.login}/${name}&event=PushEvent`
      );

      if (owner.type === "User") {
        users.push(repoObj);
      } else if (owner.type === "Organization") {
        orgs.push(repoObj);
      } else {
        other.push(repoObj);
      }

      res.push(repoObj);
    }
  }

  const jsonData = {
    users,
    orgs,
    other,
    total: res.length,
  };
  const commitsData = {
    userCommits,
    repoCommits
  };
  const jsonContent = JSON.stringify(jsonData, null, 2);
  const commitsContent = JSON.stringify(commitsData, null, 2);

  fs.writeFile("reposData.json", jsonContent, "utf8", function (err) {
    if (err) {
      console.log("An error occurred while writing JSON Object to File.");
      console.log(err);
    } else {
      console.log("JSON file has been saved.");
    }
  });
  fs.writeFile("commitsData.json", commitsContent, "utf8", function (err) {
    if (err) {
      console.log("An error occurred while writing JSON Object to File.");
      console.log(err);
    } else {
      console.log("JSON file has been saved.");
    }
  });
}

fetchData();
