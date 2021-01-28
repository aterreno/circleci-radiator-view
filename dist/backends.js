function buildBackend(settings, callback) {
  const branchFilter = (build) => (settings.branch ? build.branch.match(settings.branch) : true)
  const repositoryFilter = (build) =>
    settings.repositories ? settings.repositories.split(',').includes(build.repository) : true

  return () => {
    circleBackend(settings, (err, data) => {
      if (err) {
        return callback(err)
      }
      let builds = data.filter(repositoryFilter).filter(branchFilter)
      builds = _.uniqBy(builds, (b) => b.repository + b.branch)
      builds = builds.sort((a, b) => a.started.getTime() - b.started.getTime())
      callback(undefined, builds)
    })
  }
}

function backendOptions() {
  return {
    circle: {
      name: 'Circle CI',
      url: 'https://circleci.com/api/v1.1/projects',
      token: CIRCLE_CI_TOKEN,
    },
  }
}

async function httpRequest(url) {
  try {
    const response = await fetch('.netlify/functions/proxy?url=' + url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (response.status === 401 || response.status === 403) {
      console.log('Invalid API token (' + response.status + ' ' + response.responseText + ')')
      return {}
    }
    if (response.status >= 200 && response.status < 400) {
      return response.json()
    }
  } catch (error) {
    console.log('Error fetching URL', url)
    console.log(error)
  }
}

const circleBackend = (settings, resultCallback) => {
  const url = `${settings.url}?circle-token=${settings.token}`

  function findLatestCreatedAtTime(workflowValues) {
    return workflowValues.map((x) => new Date(x.created_at).getTime()).sort()[
      workflowValues.length - 1
    ]
  }

  function currentWorkflowsStatus(workflowValues, latestTime) {
    const currentWorkflowStatuses = workflowValues
      .filter((x) => new Date(x.created_at).getTime() === latestTime)
      .map((x) => x.status)
    if (currentWorkflowStatuses.includes('failed')) {
      return 'failed'
    }
    return currentWorkflowStatuses[0]
  }

  const parse = (data) => {
    return data
      .reduce(
        (acc, repository) =>
          acc.concat(
            Object.keys(repository.branches).map((branchName) => {
              const branch = repository.branches[branchName]
              const hasNeverBuilt = !branch.running_builds && !branch.recent_builds
              if (hasNeverBuilt) {
                return
              }
              const buildIsRunning = branch.running_builds.length != 0
              const build = buildIsRunning ? branch.running_builds[0] : branch.recent_builds[0]
              if (!build) {
                return {
                  repository: repository.reponame,
                  branch: branchName,
                  started: new Date("1970"),
                  state: "N/A",
                  commit: {
                    created: new Date("1970"),
                    author: null,
                    hash: "N/A",
                  },
                }
              }
              let status =  buildIsRunning ? build.status : build.outcome
              if (branch.is_using_workflows) {
                const workflowValues = Object.values(branch.latest_workflows)
                latestCreatedAtTime = findLatestCreatedAtTime(workflowValues)
                status = currentWorkflowsStatus(workflowValues, latestCreatedAtTime)
              }
              return {
                repository: repository.reponame,
                branch: branchName,
                started: new Date(build.pushed_at),
                state: status,
                commit: {
                  created: new Date(build.pushed_at),
                  author: null,
                  hash: build.vcs_revision,
                },
              }
            })
          ),
        []
      )
      .filter((build) => !!build)
  }

  ;(async () => {
    const data = await httpRequest(url)
    const builds = parse(data)
    resultCallback(undefined, builds)
  })()
}
