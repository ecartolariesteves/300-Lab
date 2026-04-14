using System;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Net.Http;

namespace ConsoleApp3
{
    class Program
    {
        static void Main(string[] args)
        {
            try
            {
                string apiUrl = "https://apidatos.ree.es/es/datos/generacion/estructura-generacion?start_date=2014-01-01T00:00&end_date=2018-12-31T23:59&time_trunc=year&geo_trunc=electric_system&geo_limit=ccaa&geo_ids=21";  // Reemplaza con la URL real de la API
                string connectionString = @"Data Source=SQLEXPRESS;Initial Catalog=AdventureWorks2019;User Id=test;Password=test123;Integrated Security=False;";

                // Obtener los datos de la API
                // Getting data from the API
                string jsonResponse = GetApiData(apiUrl);

                // Guardamos la conexión con SQL
                // We keep the connection with SQL
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    // Abrimos la conexión
                    connection.Open();

                    // Creamos la instrucción de inserción
                    // We create the insert statement
                    string insertStatement = "INSERT INTO AdventureWorks2019.[dbo].[tablaJSON]([JSON],[FechaCarga],[Metodo]) VALUES(@responseData, getdate(), 'Metodo_REE')";

                    // Creamos un objeto de SqlCommand con la instrucción de inserción y el objeto de SqlConnection
                    // We create a SqlCommand object with the insert statement and the SqlConnection object
                    using (SqlCommand command = new SqlCommand(insertStatement, connection))
                    {
                        // Agregamos el parámetro
                        // We add the parameter
                        command.Parameters.AddWithValue("@responseData", jsonResponse);

                        // Ejecutamos la instrucción de inserción
                        // We execute the insert statement
                        int rowsAffected = command.ExecuteNonQuery();
                    }
                }

                Console.WriteLine("Datos insertados correctamente.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Este método realiza una solicitud HTTP a la URL de la API y devuelve la respuesta como una cadena JSON.
        /// This method makes an HTTP request to the API URL and returns the response as a JSON string.
        /// </summary>
        /// <param name="apiUrl">La URL de la API a la que se realiza la solicitud.</param>
        /// <param name="apiUrl">The URL of the API to which the request is made.</param>
        /// <returns>La respuesta de la API como una cadena JSON.</returns>
        /// <returns>The API response as a JSON string.</returns>
        private static string GetApiData(string apiUrl)
        {
            string json = "";

            // Realizar la solicitud HTTP utilizando HttpClient
            // Make HTTP request using HttpClient
            using (HttpClient client = new HttpClient())
            {
                // Realizar la solicitud GET a la API
                HttpResponseMessage response = client.GetAsync(apiUrl).Result;

                // Verificar si la solicitud fue exitosa (código de estado 200 OK)
                // Check if the request was successful (status code 200 OK)
                if (response.IsSuccessStatusCode)
                {
                    // Leer y mostrar los datos de la respuesta
                    // Read and display response data
                    json = response.Content.ReadAsStringAsync().Result;
                    Debug.WriteLine(json);
                }
                else
                {
                    // Mostrar un mensaje de error en caso de que la solicitud no sea exitosa
                    // Display an error message if the request is not successful
                    Debug.WriteLine($"Error: {response.StatusCode} - {response.ReasonPhrase}");
                }
            }

            return json;
        }
    }
}