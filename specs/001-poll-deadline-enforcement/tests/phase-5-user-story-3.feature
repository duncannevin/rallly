Feature: Automatic Poll Closure
  As a poll creator
  I want my poll to automatically close when the deadline passes
  So that new votes are prevented while existing votes remain visible

  Background:
    Given a poll exists with id "poll1"
    And the poll has a deadline set
    And the poll status is "live"

  Scenario: Poll automatically closes when deadline passes
    Given poll "poll1" has a deadline that has just passed
    When the close-expired-polls cron job runs
    Then poll "poll1" status should be updated to "paused"
    And poll "poll1" should no longer accept new votes

  Scenario: Poll creator receives email notification when poll closes
    Given poll "poll1" has a deadline that has just passed
    And poll "poll1" has a creator with email "creator@example.com"
    When the close-expired-polls cron job runs
    Then an email should be sent to "creator@example.com"
    And the email should contain the poll title
    And the email should contain the deadline date and time
    And the email should contain a link to view the poll

  Scenario: New votes are blocked after deadline passes
    Given poll "poll1" has a deadline that has already passed
    And poll "poll1" status is "paused"
    When I attempt to submit a new vote for poll "poll1"
    Then I should see an error message indicating the deadline has passed
    And the error message should display the deadline date and time
    And my vote should not be recorded

  Scenario: Existing votes remain visible after deadline passes
    Given poll "poll1" has a deadline that has already passed
    And poll "poll1" has existing votes from participants
    When I view poll "poll1"
    Then I should see all existing votes
    And I should see the poll results
    And the poll status should be "paused"

  Scenario: Synchronous deadline check closes poll if cron job missed it
    Given poll "poll1" has a deadline that has passed
    And poll "poll1" status is still "live" (cron job missed it)
    When I load poll "poll1" via polls.get query
    Then poll "poll1" status should be updated to "paused" synchronously
    And the poll should be closed immediately

  Scenario: Cron job processes polls in batches
    Given 150 polls exist with deadlines that have passed
    And all polls have status "live"
    When the close-expired-polls cron job runs
    Then all 150 polls should be closed
    And polls should be processed in batches of 100
    And email notifications should be sent to all poll creators

  Scenario: Voting is blocked when attempting to update existing vote after deadline
    Given poll "poll1" has a deadline that has already passed
    And poll "poll1" has an existing participant with votes
    When I attempt to update my vote for poll "poll1"
    Then I should see an error message indicating the deadline has passed
    And my vote should not be updated

  Scenario: Multiple polls are closed simultaneously
    Given poll "poll1" has a deadline that has passed
    And poll "poll2" has a deadline that has passed
    And poll "poll3" has a deadline in the future
    When the close-expired-polls cron job runs
    Then poll "poll1" status should be "paused"
    And poll "poll2" status should be "paused"
    And poll "poll3" status should remain "live"

  Scenario: Polls without deadlines are not affected
    Given poll "poll1" has no deadline set
    And poll "poll1" status is "live"
    When the close-expired-polls cron job runs
    Then poll "poll1" status should remain "live"
    And poll "poll1" should continue to accept votes

