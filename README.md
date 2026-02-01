# Simple Room Reservation API (v1)

Tämä projekti on kevyt REST-API huonevarausten hallintaan. Se on tarkoitettu kehitys- ja prototyyppikäyttöön: tiedot pidetään muistissa (in-memory) ja palvelussa on aluksi 10 varattavaa huonetta (id 1–10).

Oletukset:
- Huoneiden määräksi on asetettu 10 aluksi, koska huoneiden määrästä ei ole tietoa.
- Varaukset vastaanotetaan, säilötään ja näytetään UTC aikana APIssa, koska aikavyöhykkettä ei ole sovittu, ja ajan säilöminen on käytännöllisempää UTC aikana APIn sisällä. Täten varauksen tekeminen ei tapahdu Suomen aikaan suoraan APIssa.
- Varauksien pituudesta tai työajasta, johon varauksia voi sijoittaa, ei ole sovittu, mutta varaukset on alustavasti rajattu maksimissaan 12 tunnin pituisiksi, jotta varaukset eivät voi olla päiväkausia pitkiä.
- Varaukset eivät saa olla päällekkäin, mutta seuraava varaus voi alkaa samalla minuutilla kuin viimeisin varaus, jotta varauksia voi tehdä peräkkäin ilman minuutin eroa järjestelmässä. Esim. Varaus 1: 10:00 - 10:30, Varaus 2: 10:30 - 11:00.
- Tehdyt aikavaraukset normalisoidaan minuuttiin tarkkuuteen, jotta varauksien sekunnit eivät vaikuta ajanvaraukseen.
- Varaukset numeroidaan ensimmäisestä alkaen, joten ensimmäisen varauksen id on 1, toisen id on 2 jne.

Kieli: JavaScript (Node.js + Express)  
API-versiointi: /api/v1/...  
Oletusportti: 3000 (ympäristömuuttuja PORT)

Sisältö
- Yleiskatsaus
- Asennus ja käynnistys
- API-rajapinta (esimerkit)
- Aikojen formaatti ja varauslogiikka
- Virheilmoitukset ja HTTP-statukset
- Testaus
- Tiedostorakenne & kehityssuositukset

---

## Yleiskatsaus

- 10 huonetta: ID 1..10
- Jokaisella huoneella oma varauslista (varastoituna muistiin, joten varaukset näkyvät ainoastaan palvelimen käytön ajan)
- Aikojen syöte: RFC 3339 (ISO 8601) -merkkijono (esim. `2026-01-24T15:00:00Z`)
- Sisäisessä tallennuksessa ajat ovat kokonaislukuja (millisekunteja).
- Sekunnit ja millisekunnit katkaistaan (truncation) minuutin tarkkuuteen (esim. `15:00:30` -> `15:00:00`) jotta pienet erot eivät aiheuta odottamattomia konflikteja.
- Varaukset käsitellään puoliavoimina väleinä [start, end) — alkupiste sisältyy, loppupiste ei. Tämä sallii peräkkäiset varaukset siten, että yhden varauksen loppu voi olla täsmälleen seuraavan varauksen alku ilman konfliktia.

---

## Asennus ja käynnistys

1. Hae lähdekoodi ja siirry projektihakemistoon.
2. Asenna riippuvuudet:
```bash
npm install
```
3. Kehitystilassa (automaattinen uudelleenkäynnistys nodemonilla):
```bash
npm run dev
```
4. Tai käynnistä normaali palvelin:
```bash
npm start
```
Palvelin kuuntelee oletuksena osoitteessa `http://localhost:3000`.

Ympäristömuuttuja:
- `PORT` — palvelimen portti (oletus 3000)

Lokitus: morgan on aktivoitu (common-format). Lokimerkinnät ilmestyvät konsoliin.

---

## API-rajapinta

Kaikki reitit ovat polun alla `/api/v1`.

Saatavuus: huoneet 1..10 (muista käyttää oikeaa `roomId`-arvoa).

1) Listaa yhden huoneen kaikki varaukset
- GET /api/v1/rooms/:roomId/reservations

Esimerkki:
```bash
curl http://localhost:3000/api/v1/rooms/1/reservations
```

Esimerkkivastaus (200 OK):
```json
{
  "roomId": 1,
  "reservations": [
    {
      "id": 1,
      "start": "2026-01-25T14:00:00.000Z",
      "end": "2026-01-25T15:00:00.000Z",
      "createdAt": "2026-01-20T12:34:56.000Z"
    }
  ]
}
```

2) Luo varaus (huomioi että aijan tulee olla tulevaisuudessa)
- POST /api/v1/rooms/:roomId/reservations
- Body (JSON):
```json
{
  "start": "2026-04-25T14:00:00Z",
  "end": "2026-04-25T15:00:00Z"
}
```

Esimerkki:
```bash
curl -X POST http://localhost:3000/api/v1/rooms/1/reservations \
  -H "Content-Type: application/json" \
  -d '{"start":"2026-04-25T14:00:00Z","end":"2026-04-25T15:00:00Z"}'
```

Onnistunut luonti (201 Created):
```json
{
  "message": "Reservation created",
  "roomId": 1,
  "reservation": {
    "id": 1,
    "start": "2026-04-25T14:00:00.000Z",
    "end": "2026-04-25T15:00:00.000Z",
    "createdAt": "2026-01-20T12:34:56.000Z"
  }
}
```

Virhetapaukset (esimerkkejä):
- Puuttuva `start` tai `end` -> 400 Bad Request
- Epäkelpo aikamuoto (ei RFC 3339) -> 400 Bad Request
- `end` ei ole suurempi kuin `start` (loppu ennen alkua tai samat ajat) -> 400 Bad Request
- Varaus normalisoinnin (minuutti-truncate) jälkeen tulee epäkelvoksi -> 400 Bad Request
- Varaus alkaa menneisyydessä -> 400 Bad Request
- Varaus on yli 12 tuntia pitkä -> 400 Bad Request
- Aikatason päällekkäisyys jo olemassa olevan varauksen kanssa -> 409 Conflict
- Konfliktivastauksessa palautetaan myös `conflict`-objekti, joka kertoo ristiriitaisen varauksen id:n ja ajat.

Esimerkki päällekkäisyysvastauksesta (409):
```json
{
  "error": "Time conflict with existing reservation",
  "conflict": {
    "id": 1,
    "start": "2026-01-25T14:00:00.000Z",
    "end": "2026-01-25T15:00:00.000Z"
  }
}
```

3) Poista varaus
- DELETE /api/v1/rooms/:roomId/reservations/:reservationId

Esimerkki:
```bash
curl -X DELETE http://localhost:3000/api/v1/rooms/1/reservations/1
```

Onnistunut poisto (200 OK):
```json
{
  "message": "Reservation deleted",
  "roomId": 1,
  "reservation": {
    "id": 1,
    "start": "2026-01-25T14:00:00.000Z",
    "end": "2026-01-25T15:00:00.000Z",
    "createdAt": "2026-01-20T12:34:56.000Z"
  }
}
```

Virheet:
- Huonetta ei löydy -> 404 Not Found
- Varausta ei löydy -> 404 Not Found
- Epäkelpo reservationId -> 400 Bad Request

---

## Aikojen formaatti ja varauslogiikka (yksityiskohdat)

- Syöte:
  - Hyväksytään RFC 3339 / ISO 8601 -muotoiset merkkijonot, esimerkiksi `2026-01-24T15:00:00Z`.
  - Oletusajat voivat sisältää aikavyöhykkeen (esim. `-05:00`), mutta palvelin normalisoi sisäisesti millisekunteihin. Projektin oletus on, että käyttäjät eivät ole eri aikavyöhykkeiltä; UTC-merkintöjen käyttö on suositeltavaa.

- Sisäinen tallennus:
  - Muutetaan merkkijonot millisekunneiksi (Number).
  - Katkaistaan (truncation) sekunnit ja millisekunnit minuutin tarkkuuteen:
    - Esim. `2026-01-25T14:00:30Z` -> tallennetaan `2026-01-25T14:00:00Z`.
    - Tämä estää pieniä millisekunti- tai sekuntieroja aiheuttamasta ristiriitoja.
  - Varaukset tallennetaan muodossa:
    - { id, startMs, endMs, startIso, endIso, createdAt }

- Varmistettavat säännöt varauksen luomisessa:
  1. `start` ja `end` täytyy olla kelvollisia aikamerkkijonoja.
  2. `end` > `start` (ennen tai yhtä suuri ei kelpaa). Tämä tarkistus tehdään sekä ennen että jälkeen minuutti-normalisoinnin — jos normalisointi tekee ajat yhtäsuuriksi, pyyntö hylätään.
  3. `start` ei voi olla menneisyydessä. Aikavertailu tehdään minuutti-normalisoidun "nyt" -hetken kanssa (eli varaus voi alkaa täsmälleen tällä minuutilla mutta ei ennen).
  4. Varaukset eivät saa päällekkäistyä saman huoneen muiden varausten kanssa. Käytetty päällekkäistarkistus on periaatteessa:
     - kaksi väliä A=[aStart,aEnd) ja B=[bStart,bEnd) päällekkäisevät jos:
       ```
       aStart < bEnd && bStart < aEnd
       ```
     - Tämä sallii peräkkäisyyden, jossa `existing.end === new.start` (ei päällekkäisyys).

- Miksi puoliavoin [start, end)?
  - Puoliaukia intervallit antavat luonnollisen sallitun "seam"-käyttäytymisen: yhden varauksen loppu voi olla seuraavan varauksen alku ilman konfliktia.

---

## Virheilmoitukset ja status-koodit (yhteenvedoksi)

- 200 OK — Listaus tai poistamisen jälkeen onnistunut vastaus
- 201 Created — Varauksen luonti onnistui
- 400 Bad Request — Puuttuvat kentät / väärä formaatti / end <= start / normalisoinnin jälkeinen virhe / start menneisyydessä
- 404 Not Found — Huonetta tai varausta ei löydy
- 409 Conflict — Aikakonflikti olemassa olevan varauksen kanssa
- 500 Internal Server Error — Muut odottamattomat virheet

---

## Testaus

Projekti sisältää Jest + Supertest -testit (polku `tests/`).

Suorita testit:
```bash
npm test
```

Testit resetoivat in-memory-datan (`resetData`) jokaisen testin alussa, joten ne ovat deterministisiä kun aika liittyvät testit käyttävät suhteellisia aikoja (Date.now -perusteiset).

Huom:
- Älä aja palvelinta samalla portilla kun ajat testejä ellei testit ole konfiguroitu käyttämään erillistä instanssia; testit käyttävät `app`-eksporttia, eivätkä käynnistä HTTP-palvelinta.

---

## Seuraavat askeleet

- Lisää schema-validointi (esim. zod tai Joi) jotta virheilmoitukset ovat selkeämpiä ja muuttuvat helpommin ylläpidettäviksi.
- Keskitetty virheenkäsittely (HttpError-luokka + error middleware) yhtenäistää vastemuodot.
- Lisää yksikkötestit ajan käsittelylle (truncate/overlap) erillisinä testeinä.
- Turvallisuus: lisää `helmet`, pyydysten rajoitus (rate limiting) ja body-size limitit.
- Lokitus: harkitse rakenteellista lokitusta (pino tai pino/pino) ja lokin taso konfiguraatiolla (dev/test/prod).