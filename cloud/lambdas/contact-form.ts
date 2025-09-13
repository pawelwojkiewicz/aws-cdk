// KROK 1: Importowanie modułów z AWS SDK v3
// W nowej wersji SDK, każda usługa i każda komenda są importowane z osobnych,
// małych pakietów. Dzięki temu finalna paczka z kodem jest mniejsza i szybsza.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'; // Podstawowy "klient" do komunikacji z DynamoDB.
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'; // "DocumentClient" to pomocnik ułatwiający pracę z obiektami JSON. "PutCommand" to komenda zapisu.
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
  // Parsujemy dane (payload) wysłane z formularza w Angularze.
  // Są one przekazywane jako tekst w polu "body" obiektu "event".
  const { name, email, message } = JSON.parse(event.body);

  // Weryfikujemy, czy CDK poprawnie przekazało nam konfigurację.
  // To zabezpieczenie (tzw. "guard clause") chroni nas przed błędami.
  const tableName = process.env.TABLE_NAME;
  const senderEmail = process.env.SENDER_EMAIL;

  if (!tableName || !senderEmail) {
    // Jeśli brakuje konfiguracji, natychmiast przerywamy działanie z jasnym błędem.
    throw new Error('Brak zdefiniowanych zmiennych środowiskowych (TABLE_NAME lub SENDER_EMAIL)');
  }

  // KROK 4: Zapis do DynamoDB w stylu SDK v3
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

  try {
    // Wysyłamy przygotowaną komendę do DynamoDB za pomocą klienta.
    await ddbDocClient.send(putCommand);
  } catch (dbError) {
    console.error('Błąd DynamoDB:', dbError);
    throw new Error('Nie udało się zapisać wiadomości'); // To spowoduje błąd 502 w API Gateway.
  }

  // KROK 5: Wysyłka e-maila przez SES w stylu SDK v3
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

  try {
    // Wysyłamy komendę e-maila do usługi SES.
    await sesClient.send(sendEmailCommand);
  } catch (sesError) {
    console.error('Błąd SES:', sesError);
    throw new Error('Nie udało się wysłać e-maila'); // To również spowoduje błąd 502.
  }

  // KROK 6: Zwrócenie poprawnej odpowiedzi do API Gateway
  // Jeśli wszystko powyżej się udało, wysyłamy do przeglądarki status 200 OK.
  return {
    statusCode: 200,
    headers: {
      // Nagłówek CORS jest kluczowy, aby przeglądarka zaakceptowała odpowiedź z innego adresu URL.
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    // Przesyłamy odpowiedź w formacie JSON.
    body: JSON.stringify({ message: 'Wiadomość zapisana i e-mail wysłany!' }),
  };
};
