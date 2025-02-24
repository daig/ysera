import { Api } from './api/constellationApi';

async function getTypes() {
  // Create an instance of the API client
  const api = new Api({
    // You can add configuration here if needed
    secure: true, // Since the endpoint requires authentication
  });

  try {
    // Call the typeList endpoint
    const types = await api.obj.typeList();
    console.log('All available types:');
    types.forEach(type => {
      console.log(`\nType: ${type.fullName}`);
      console.log(`Description: ${type.description}`);
      console.log(`Fields: ${type.fields?.length || 0}`);
    });
  } catch (error) {
    console.error('Error fetching types:', error);
  }
}

// Run the function
getTypes(); 