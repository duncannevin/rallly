Feature: Reminder Emails to Non-Responders
  As a poll participant
  I want to receive reminder emails before the deadline
  So that I don't forget to respond to polls

  Background:
    Given a poll exists with id "poll1"
    And the poll has a title "Team Meeting"
    And the poll has a deadline set
    And the poll status is "live"

  Scenario: Participant receives 24-hour reminder email
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Alice" with email "alice@example.com"
    And participant "Alice" has not voted
    When the send-reminder-emails cron job runs
    Then an email should be sent to "alice@example.com"
    And the email should contain the poll title "Team Meeting"
    And the email should contain the deadline date and time
    And the email should contain time remaining (approximately 23 hours)
    And the email should contain a link to respond to the poll
    And a Reminder record should be created for participant "Alice" with type "twentyFourHours"

  Scenario: Participant receives 6-hour reminder email
    Given poll "poll1" has a deadline 5 hours and 30 minutes from now
    And poll "poll1" has a participant "Bob" with email "bob@example.com"
    And participant "Bob" has not voted
    And participant "Bob" has not received a "twentyFourHours" reminder
    When the send-reminder-emails cron job runs
    Then an email should be sent to "bob@example.com"
    And the email should contain the poll title "Team Meeting"
    And the email should contain the deadline date and time
    And the email should contain time remaining (approximately 5 hours)
    And the email should contain a link to respond to the poll
    And a Reminder record should be created for participant "Bob" with type "sixHours"

  Scenario: Participant receives 1-hour reminder email
    Given poll "poll1" has a deadline 30 minutes from now
    And poll "poll1" has a participant "Charlie" with email "charlie@example.com"
    And participant "Charlie" has not voted
    And participant "Charlie" has not received a "twentyFourHours" reminder
    And participant "Charlie" has not received a "sixHours" reminder
    When the send-reminder-emails cron job runs
    Then an email should be sent to "charlie@example.com"
    And the email should contain the poll title "Team Meeting"
    And the email should contain the deadline date and time
    And the email should contain time remaining (approximately 30 minutes)
    And the email should contain a link to respond to the poll
    And a Reminder record should be created for participant "Charlie" with type "oneHour"

  Scenario: Participant who has already voted does not receive reminder
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Diana" with email "diana@example.com"
    And participant "Diana" has voted
    When the send-reminder-emails cron job runs
    Then no email should be sent to "diana@example.com"
    And no Reminder record should be created for participant "Diana"

  Scenario: Participant does not receive duplicate reminders for same interval
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Eve" with email "eve@example.com"
    And participant "Eve" has not voted
    And participant "Eve" has already received a "twentyFourHours" reminder
    When the send-reminder-emails cron job runs
    Then no email should be sent to "eve@example.com"
    And no new Reminder record should be created for participant "Eve" with type "twentyFourHours"

  Scenario: Participant without email address does not receive reminder
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Frank" without an email address
    And participant "Frank" has not voted
    When the send-reminder-emails cron job runs
    Then no email should be sent for participant "Frank"
    And no Reminder record should be created for participant "Frank"

  Scenario: Multiple participants with same email receive single email listing all participants
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Grace" with email "team@example.com"
    And poll "poll1" has a participant "Henry" with email "team@example.com"
    And participant "Grace" has not voted
    And participant "Henry" has not voted
    When the send-reminder-emails cron job runs
    Then a single email should be sent to "team@example.com"
    And the email should list participant "Grace"
    And the email should list participant "Henry"
    And a Reminder record should be created for participant "Grace" with type "twentyFourHours"
    And a Reminder record should be created for participant "Henry" with type "twentyFourHours"

  Scenario: Reminders are not sent for polls without deadlines
    Given poll "poll2" exists without a deadline
    And poll "poll2" has a participant "Iris" with email "iris@example.com"
    And participant "Iris" has not voted
    When the send-reminder-emails cron job runs
    Then no email should be sent to "iris@example.com"
    And no Reminder record should be created for poll "poll2"

  Scenario: Reminders are not sent for polls that have passed their deadline
    Given poll "poll1" has a deadline that has already passed
    And poll "poll1" has a participant "Jack" with email "jack@example.com"
    And participant "Jack" has not voted
    When the send-reminder-emails cron job runs
    Then no email should be sent to "jack@example.com"
    And no Reminder record should be created for participant "Jack"

  Scenario: Reminders are not sent for paused polls
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" status is "paused"
    And poll "poll1" has a participant "Kelly" with email "kelly@example.com"
    And participant "Kelly" has not voted
    When the send-reminder-emails cron job runs
    Then no email should be sent to "kelly@example.com"
    And no Reminder record should be created for participant "Kelly"

  Scenario: Reminder emails handle errors gracefully
    Given poll "poll1" has a deadline 23 hours and 30 minutes from now
    And poll "poll1" has a participant "Larry" with email "larry@example.com"
    And participant "Larry" has not voted
    And email sending for "larry@example.com" will fail
    When the send-reminder-emails cron job runs
    Then the error should be logged
    And processing should continue for other polls
    And no Reminder record should be created for participant "Larry"

