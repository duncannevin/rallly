Feature: Edit Poll Deadline
  As a poll creator
  I want to edit or remove the deadline on existing polls
  So that I can adjust deadlines before they pass

  Background:
    Given a poll exists with id "poll1"
    And the poll has a deadline set
    And I am the creator of poll "poll1"

  Scenario: Edit deadline on poll with future deadline
    Given poll "poll1" has a deadline 5 days in the future
    When I navigate to the poll settings page for poll "poll1"
    Then I should see the deadline field with the current deadline value
    And the deadline should be displayed in my timezone
    And I should be able to edit the deadline date
    And I should be able to edit the deadline time
    When I update the deadline to 7 days in the future
    And I save the poll settings
    Then the deadline should be updated to 7 days in the future
    And the deadline should be stored in UTC in the database

  Scenario: Remove deadline from poll
    Given poll "poll1" has a deadline 5 days in the future
    When I navigate to the poll settings page for poll "poll1"
    And I clear the deadline field
    And I save the poll settings
    Then poll "poll1" should have no deadline set
    And the deadline field should be null in the database

  Scenario: Deadline is read-only when deadline has passed
    Given poll "poll1" has a deadline that has already passed
    When I navigate to the poll settings page for poll "poll1"
    Then the deadline field should be displayed as read-only
    And I should see a message indicating the deadline has passed
    And the message should display the deadline date and time
    And I should not be able to edit the deadline date
    And I should not be able to edit the deadline time
    And I should not be able to clear the deadline

  Scenario: Cannot update deadline if existing deadline has passed
    Given poll "poll1" has a deadline that has already passed
    When I attempt to update poll "poll1" with a new deadline via API
    Then I should receive an error indicating the deadline cannot be edited
    And the error message should indicate the deadline has passed
    And the deadline should remain unchanged

  Scenario: New deadline must be in the future
    Given poll "poll1" has a deadline 5 days in the future
    When I navigate to the poll settings page for poll "poll1"
    And I attempt to set the deadline to a date in the past
    Then I should see a validation error
    And the error should indicate the deadline must be in the future
    And the deadline should not be saved

  Scenario: Deadline timezone conversion works correctly
    Given poll "poll1" has a deadline set in UTC
    And poll "poll1" has a timezone of "America/New_York"
    When I navigate to the poll settings page for poll "poll1"
    Then the deadline should be displayed in "America/New_York" timezone
    When I update the deadline to a new date/time
    And I save the poll settings
    Then the deadline should be converted to UTC before storing
    And the stored deadline should be correct in UTC

  Scenario: Deadline can be edited multiple times
    Given poll "poll1" has a deadline 5 days in the future
    When I navigate to the poll settings page for poll "poll1"
    And I update the deadline to 7 days in the future
    And I save the poll settings
    Then the deadline should be updated to 7 days in the future
    When I navigate to the poll settings page again
    And I update the deadline to 10 days in the future
    And I save the poll settings
    Then the deadline should be updated to 10 days in the future

  Scenario: Deadline editing preserves other poll settings
    Given poll "poll1" has a deadline 5 days in the future
    And poll "poll1" has hideParticipants set to true
    And poll "poll1" has disableComments set to true
    When I navigate to the poll settings page for poll "poll1"
    And I update the deadline to 7 days in the future
    And I save the poll settings
    Then the deadline should be updated to 7 days in the future
    And hideParticipants should remain true
    And disableComments should remain true

  Scenario: Deadline can be set on poll without existing deadline
    Given poll "poll1" has no deadline set
    When I navigate to the poll settings page for poll "poll1"
    Then I should see an empty deadline field
    And I should be able to set a deadline
    When I set the deadline to 5 days in the future
    And I save the poll settings
    Then poll "poll1" should have the deadline set
    And the deadline should be stored correctly

