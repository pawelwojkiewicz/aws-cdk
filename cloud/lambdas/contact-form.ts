// KROK 1: Importowanie modułów z AWS SDK v3
// W nowej wersji SDK, każda usługa i każda komenda są importowane z osobnych,
// małych pakietów. Dzięki temu finalna paczka z kodem jest mniejsza i szybsza.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'; // Podstawowy "klient" do komunikacji z DynamoDB.
// NOWA ZMIANA: Importujemy 'ScanCommand', aby móc pobierać wszystkie rekordy.
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'; // "DocumentClient" to pomocnik. "PutCommand" to komenda zapisu, "ScanCommand" to komenda skanowania tabeli.
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'; // Klient i komenda do wysyłki e-maili przez usługę SES.

// KROK 2: Inicjalizacja klientów usług AWS
// Tworzymy instancje klientów, które będą naszymi "pilotami" do sterowania usługami AWS.
const dbClient = new DynamoDBClient({}); // Tworzymy podstawowego klienta DynamoDB. Puste {} oznaczają użycie domyślnej konfiguracji (region, poświadczenia).
const ddbDocClient = DynamoDBDocumentClient.from(dbClient); // Rozszerzamy podstawowego klienta o "DocumentClient", aby łatwiej operować na obiektach JavaScript.
const sesClient = new SESClient({}); // Tworzymy klienta dla usługi SES.

// KROK 3: Główna funkcja Lambda (handler)
// To jest "serce" naszej funkcji. Ten kod zostanie uruchomiony za każdym razem,
// gdy API Gateway przekaże do Lambdy zapytanie z internetu.
export const handler = async (event: any) => {
  // Weryfikujemy, czy CDK poprawnie przekazało nam konfigurację.
  // To zabezpieczenie (tzw. "guard clause") chroni nas przed błędami.
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    // Jeśli brakuje konfiguracji, natychmiast przerywamy działanie z jasnym błędem.
    throw new Error('Brak zdefiniowanej nazwy tabeli w zmiennych środowiskowych (TABLE_NAME)');
  }

  // NOWA ZMIANA: Definiujemy wspólne nagłówki CORS dla wszystkich odpowiedzi.
  // Musimy poinformować przeglądarkę, że nasze API akceptuje teraz metody POST i GET.
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET',
    'Content-Type': 'application/json',
  };

  // NOWA ZMIANA: Dodajemy blok try...catch dookoła całej logiki,
  // aby łapać błędy i zwracać spójną odpowiedź 500.
  try {
    // ==================================================================
    // KROK 4: SCENARIUSZ OBSŁUGI METODY POST (Wysłanie formularza)
    // ==================================================================
    // Sprawdzamy, czy zapytanie przyszło metodą POST.
    if (event.httpMethod === 'POST') {
      // Parsujemy dane (payload) wysłane z formularza w Angularze.
      // Są one przekazywane jako tekst w polu "body" obiektu "event".
      const { name, email, message } = JSON.parse(event.body);

      // Sprawdzamy, czy mamy e-mail nadawcy
      const senderEmail = process.env.SENDER_EMAIL;
      if (!senderEmail) {
        throw new Error('Brak zdefiniowanego SENDER_EMAIL w zmiennych środowiskowych');
      }

      // KROK 4a: Zapis do DynamoDB w stylu SDK v3
      // Tworzymy obiekt "komendy", który precyzyjnie opisuje, co chcemy zrobić.
      const putCommand = new PutCommand({
        TableName: tableName, // Nazwa tabeli, odczytana ze zmiennej środowiskowej.
        Item: {
          // Obiekt, który chcemy zapisać.
          messageId: Date.now().toString(), // Prosty, unikalny identyfikator.
          name,
          email,
          message,
          createdAt: new Date().toISOString(), // Data zapisu w standardzie ISO.
        },
      });

      // Wysyłamy przygotowaną komendę do DynamoDB za pomocą klienta.
      await ddbDocClient.send(putCommand);

      // KROK 4b: Wysyłka e-maila przez SES w stylu SDK v3
      // Podobnie jak z DynamoDB, tworzymy obiekt "komendy" dla wysyłki e-maila.
      const sendEmailCommand = new SendEmailCommand({
        Source: senderEmail, // Adres nadawcy (musi być zweryfikowany w SES).
        Destination: {
          ToAddresses: [senderEmail], // Adres odbiorcy.
        },
        Message: {
          Subject: { Data: 'Nowa wiadomość kontaktowa z AWS' },
          Body: {
            Text: { Data: `Nowa wiadomość od ${name} (${email}):\n\n${message}` },
            Html: {
              Data: `<p>Nowa wiadomość od <strong>${name}</strong> (${email}):</p><p>${message.replace(/\n/g, '<br>')}</p>`,
            },
          },
        },
      });

      // Wysyłamy komendę e-maila do usługi SES.
      await sesClient.send(sendEmailCommand);

      // KROK 4c: Zwrócenie poprawnej odpowiedzi do API Gateway (dla POST)
      // Jeśli wszystko powyżej się udało, wysyłamy do przeglądarki status 200 OK.
      return {
        statusCode: 200,
        headers: headers, // Używamy wspólnych nagłówków
        // Przesyłamy odpowiedź w formacie JSON.
        body: JSON.stringify({ message: 'Wiadomość zapisana i e-mail wysłany!' }),
      };
    }

    // ==================================================================
    // KROK 5: SCENARIUSZ OBSŁUGI METODY GET (Pobranie wiadomości)
    // ==================================================================
    // Sprawdzamy, czy zapytanie przyszło metodą GET.
    if (event.httpMethod === 'GET') {
      // KROK 5a: Skanowanie tabeli DynamoDB w stylu SDK v3
      // Tworzymy komendę Scan, która przeskanuje całą tabelę i zwróci wszystkie rekordy.
      // UWAGA: Operacja Scan jest kosztowna dla dużych tabel. Dla małych projektów jest idealna.
      const scanCommand = new ScanCommand({
        TableName: tableName,
      });

      // Wysyłamy komendę i czekamy na wyniki.
      const results = await ddbDocClient.send(scanCommand);

      // KROK 5b: Zwrócenie poprawnej odpowiedzi do API Gateway (dla GET)
      return {
        statusCode: 200,
        headers: headers, // Używamy wspólnych nagłówków
        // Zwracamy tablicę 'Items', która zawiera wszystkie znalezione wiadomości.
        body: JSON.stringify({ messages: results.Items }),
      };
    }

    // ==================================================================
    // KROK 6: SCENARIUSZ DLA INNYCH METOD (np. PUT, DELETE)
    // ==================================================================
    // Jeśli ktoś spróbuje użyć innej metody, której nie obsługujemy.
    return {
      statusCode: 405, // 405 = Method Not Allowed
      headers: headers,
      body: JSON.stringify({ message: 'Metoda nie jest dozwolona' }),
    };
  } catch (error) {
    // KROK 7: Ogólna obsługa błędów
    // Jeśli którykolwiek z powyższych kroków (POST lub GET) rzuci błąd.
    console.error('Wystąpił błąd:', error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ message: 'Wystąpił błąd wewnętrzny serwera' }),
    };
  }
};
