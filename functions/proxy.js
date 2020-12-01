const axios = require('axios')

exports.handler = async (event) => {
  const {
    queryStringParameters: { url },
  } = event

  try {
    const response = await axios.get(url)
    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
    }
  } catch (error) {
    console.log(error)
    return {
      statusCode: response.status,
      body: JSON.stringify(error),
    }
  }
}
