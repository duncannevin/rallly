Feature: Deadline Feature Polish and Integration
  As a system
  I want the deadline feature to work smoothly with all existing features
  So that the user experience is seamless

  Background:
    Given the deadline enforcement feature has been implemented
    And all previous phases (1-7) have been completed

  Scenario: Deadline information appears in poll lists
    Given multiple polls exist with deadlines
    When I view the poll list/dashboard
    Then polls with deadlines should display deadline information
    And the deadline information should be formatted correctly

  Scenario: Timezone handling works across different user timezones
    Given poll "poll1" has a deadline set in UTC
    And user "user1" is in timezone "America/New_York"
    And user "user2" is in timezone "Europe/London"
    When user "user1" views poll "poll1"
    Then the deadline should display in "America/New_York" timezone
    When user "user2" views poll "poll1"
    Then the deadline should display in "Europe/London" timezone
    And both users should see the same UTC deadline converted correctly

  Scenario: Analytics events include deadline information
    Given a poll is created with a deadline
    When the poll creation analytics event is captured
    Then the event should include deadline information
    And the event should include whether a deadline was set

  Scenario: Analytics events track deadline updates
    Given a poll exists with a deadline
    When the poll deadline is updated
    Then the poll_update_deadline analytics event should be captured
    And the event should include the new deadline information

  Scenario: Performance requirements are met
    Given 1000 polls exist with deadlines
    When the deadline enforcement cron job runs
    Then the job should complete within 5 minutes
    And all polls with passed deadlines should be closed

  Scenario: Reminder email job completes within time limits
    Given 500 polls exist with upcoming deadlines
    And participants exist who need reminder emails
    When the reminder email cron job runs
    Then the job should complete within acceptable time limits
    And all eligible participants should receive reminder emails

  Scenario: Error handling for edge cases
    Given poll "poll1" has an invalid deadline configuration
    When the deadline enforcement process attempts to process poll "poll1"
    Then the error should be logged
    And the error should not prevent other polls from being processed
    And the system should continue to function normally

  Scenario: Timezone conversion handles DST transitions
    Given poll "poll1" has a deadline during a daylight saving time transition
    When I view poll "poll1" in a timezone that observes DST
    Then the deadline should display correctly
    And no errors should occur during timezone conversion

  Scenario: Invalid timezone handling
    Given poll "poll1" has an invalid timezone value
    When the system attempts to format the deadline for display
    Then the system should fall back to UTC
    And the error should be logged
    And the deadline should still display correctly

  Scenario: Logging provides monitoring information
    Given the deadline enforcement cron job runs
    When polls are closed at deadline
    Then the closure events should be logged with poll IDs
    And the log should include the number of polls closed
    And the log should include the duration of the job

  Scenario: Reminder email logging provides monitoring information
    Given the reminder email cron job runs
    When reminder emails are sent
    Then the sending events should be logged with poll IDs
    And the log should include the number of reminders sent
    And the log should include the duration of the job

  Scenario: Integration with existing poll features
    Given a poll exists with a deadline
    And the poll has participants who have voted
    When the deadline passes
    Then the poll should be closed automatically
    And existing votes should remain visible
    And participants should still be able to view poll results
    And comments should still be visible
    And the poll creator should receive an email notification

  Scenario: Deadline feature does not break existing functionality
    Given polls exist without deadlines
    When I create a new poll without a deadline
    Then the poll should function normally
    And all existing features should work as before
    When I view polls in the dashboard
    Then polls without deadlines should display correctly
    And polls with deadlines should display correctly

