import {
	BINARY_ENCODING,
	IExecuteFunctions,
} from 'n8n-core';

import {
	IBinaryData,
	IBinaryKeyData,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	jiraSoftwareCloudApiRequest,
	jiraSoftwareCloudApiRequestAllItems,
	validateJSON,
} from './GenericFunctions';

import {
	issueAttachmentFields,
	issueAttachmentOperations,
} from './IssueAttachmentDescription';

import {
	issueCommentFields,
	issueCommentOperations,
} from './IssueCommentDescription';

import {
	issueFields,
	issueOperations,
} from './IssueDescription';

import {
	IFields,
	IIssue,
	INotificationRecipients,
	INotify,
	NotificationRecipientsRestrictions,
} from './IssueInterface';

export class Jira implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jira Software',
		name: 'jira',
		icon: 'file:jira.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Jira Software API',
		defaults: {
			name: 'Jira',
			color: '#4185f7',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'jiraSoftwareCloudApi',
				required: true,
				displayOptions: {
					show: {
						jiraVersion: [
							'cloud',
						],
					},
				},
			},
			{
				name: 'jiraSoftwareServerApi',
				required: true,
				displayOptions: {
					show: {
						jiraVersion: [
							'server',
						],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Jira Version',
				name: 'jiraVersion',
				type: 'options',
				options: [
					{
						name: 'Cloud',
						value: 'cloud',
					},
					{
						name: 'Server (Self Hosted)',
						value: 'server',
					},
				],
				default: 'cloud',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Issue',
						value: 'issue',
						description: 'Creates an issue or, where the option to create subtasks is enabled in Jira, a subtask',
					},
					{
						name: 'Issue Attachment',
						value: 'issueAttachment',
						description: 'Add, remove, and get an attachment from an issue.',
					},
					{
						name: 'Issue Comment',
						value: 'issueComment',
						description: 'Get, create, update, and delete a comment from an issue.',
					},
				],
				default: 'issue',
				description: 'Resource to consume.',
			},
			...issueOperations,
			...issueFields,
			...issueAttachmentOperations,
			...issueAttachmentFields,
			...issueCommentOperations,
			...issueCommentFields,
		],
	};

	methods = {
		loadOptions: {
			// Get all the projects to display them to user so that he can
			// select them easily
			async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const jiraVersion = this.getCurrentNodeParameter('jiraVersion') as string;
				let endpoint = '';
				let projects;

				if (jiraVersion === 'server') {
					endpoint = '/api/2/project';
					projects = await jiraSoftwareCloudApiRequest.call(this, endpoint, 'GET');
				} else {
					endpoint = '/api/2/project/search';
					projects = await jiraSoftwareCloudApiRequestAllItems.call(this, 'values', endpoint, 'GET');
				}

				if (projects.values && Array.isArray(projects.values)) {
					projects = projects.values;
				}
				for (const project of projects) {
					const projectName = project.name;
					const projectId = project.id;
					returnData.push({
						name: projectName,
						value: projectId,
					});
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the issue types to display them to user so that he can
			// select them easily
			async getIssueTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const projectId = this.getCurrentNodeParameter('project');
				const returnData: INodePropertyOptions[] = [];

				const issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/api/2/issuetype', 'GET');
				const jiraVersion = this.getCurrentNodeParameter('jiraVersion') as string;
				if (jiraVersion === 'server') {
					for (const issueType of issueTypes) {
						const issueTypeName = issueType.name;
						const issueTypeId = issueType.id;

						returnData.push({
							name: issueTypeName,
							value: issueTypeId,
						});
					}
				} else {
					for (const issueType of issueTypes) {
						if (issueType.scope !== undefined && issueType.scope.project.id === projectId) {
							const issueTypeName = issueType.name;
							const issueTypeId = issueType.id;

							returnData.push({
								name: issueTypeName,
								value: issueTypeId,
							});
						}
					}
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});
				return returnData;
			},

			// Get all the labels to display them to user so that he can
			// select them easily
			async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const labels = await jiraSoftwareCloudApiRequest.call(this, '/api/2/label', 'GET');

				for (const label of labels.values) {
					const labelName = label;
					const labelId = label;

					returnData.push({
						name: labelName,
						value: labelId,
					});
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the priorities to display them to user so that he can
			// select them easily
			async getPriorities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const priorities = await jiraSoftwareCloudApiRequest.call(this, '/api/2/priority', 'GET');

				for (const priority of priorities) {
					const priorityName = priority.name;
					const priorityId = priority.id;

					returnData.push({
						name: priorityName,
						value: priorityId,
					});
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the users to display them to user so that he can
			// select them easily
			async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const jiraVersion = this.getCurrentNodeParameter('jiraVersion') as string;
				if (jiraVersion === 'server') {
					// the interface call must bring username
					const users = await jiraSoftwareCloudApiRequest.call(this, '/api/2/user/search', 'GET', {},
						{
							username: "'",
						},
					);
					for (const user of users) {
						const userName = user.displayName;
						const userId = user.name;

						returnData.push({
							name: userName,
							value: userId,
						});
					}
				} else {
					const users = await jiraSoftwareCloudApiRequest.call(this, '/api/2/users/search', 'GET');

					for (const user of users) {
						const userName = user.displayName;
						const userId = user.accountId;

						returnData.push({
							name: userName,
							value: userId,
						});
					}
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the groups to display them to user so that he can
			// select them easily
			async getGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const groups = await jiraSoftwareCloudApiRequest.call(this, '/api/2/groups/picker', 'GET');

				for (const group of groups.groups) {
					const groupName = group.name;
					const groupId = group.name;

					returnData.push({
						name: groupName,
						value: groupId,
					});
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the groups to display them to user so that he can
			// select them easily
			async getTransitions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];

				const issueKey = this.getCurrentNodeParameter('issueKey');
				const transitions = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}/transitions`, 'GET');

				for (const transition of transitions.transitions) {
					returnData.push({
						name: transition.name,
						value: transition.id,
					});
				}

				returnData.sort((a, b) => {
					if (a.name < b.name) { return -1; }
					if (a.name > b.name) { return 1; }
					return 0;
				});

				return returnData;
			},

			// Get all the custom fields to display them to user so that he can
			// select them easily
			async getCustomFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const operation = this.getCurrentNodeParameter('operation') as string;
				let projectId;
				if (operation === 'create') {
					projectId = this.getCurrentNodeParameter('project');
				} else {
					const issueKey = this.getCurrentNodeParameter('issueKey');
					const { fields: { project: { id } } } = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}`, 'GET', {}, {});
					projectId = id;
				}

				const fields = await jiraSoftwareCloudApiRequest.call(this, `/api/2/field`, 'GET');
				for (const field of fields) {
					if (field.custom === true && field.scope && field.scope.project && field.scope.project.id === projectId) {
						returnData.push({
							name: field.name,
							value: field.id,
						});
					}
				}
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length as unknown as number;
		let responseData;
		const qs: IDataObject = {};

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const jiraVersion = this.getNodeParameter('jiraVersion', 0) as string;

		if (resource === 'issue') {
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-post
			if (operation === 'create') {
				for (let i = 0; i < length; i++) {
					const summary = this.getNodeParameter('summary', i) as string;
					const projectId = this.getNodeParameter('project', i) as string;
					const issueTypeId = this.getNodeParameter('issueType', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const body: IIssue = {};
					const fields: IFields = {
						summary,
						project: {
							id: projectId,
						},
						issuetype: {
							id: issueTypeId,
						},
					};
					if (additionalFields.labels) {
						fields.labels = additionalFields.labels as string[];
					}
					if (additionalFields.serverLabels) {
						fields.labels = additionalFields.serverLabels as string[];
					}
					if (additionalFields.priority) {
						fields.priority = {
							id: additionalFields.priority as string,
						};
					}
					if (additionalFields.assignee) {
						if (jiraVersion === 'server') {
							fields.assignee = {
								name: additionalFields.assignee as string,
							};
						} else {
							fields.assignee = {
								id: additionalFields.assignee as string,
							};
						}
					}
					if (additionalFields.description) {
						fields.description = additionalFields.description as string;
					}
					if (additionalFields.updateHistory) {
						qs.updateHistory = additionalFields.updateHistory as boolean;
					}
					if (additionalFields.customFieldsUi) {
						const customFields = (additionalFields.customFieldsUi as IDataObject).customFieldsValues as IDataObject[];
						if (customFields) {
							const data = customFields.reduce((obj, value) => Object.assign(obj, { [`${value.fieldId}`]: value.fieldValue }), {});
							Object.assign(fields, data);
						}
					}
					const issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/api/2/issuetype', 'GET', body, qs);
					const subtaskIssues = [];
					for (const issueType of issueTypes) {
						if (issueType.subtask) {
							subtaskIssues.push(issueType.id);
						}
					}
					if (!additionalFields.parentIssueKey
						&& subtaskIssues.includes(issueTypeId)) {
						throw new Error('You must define a Parent Issue Key when Issue type is sub-task');

					} else if (additionalFields.parentIssueKey
						&& subtaskIssues.includes(issueTypeId)) {
						fields.parent = {
							key: (additionalFields.parentIssueKey as string).toUpperCase(),
						};
					}
					body.fields = fields;
					responseData = await jiraSoftwareCloudApiRequest.call(this, '/api/2/issue', 'POST', body);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-put
			if (operation === 'update') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
					const body: IIssue = {};
					const fields: IFields = {};
					if (updateFields.summary) {
						fields.summary = updateFields.summary as string;
					}
					if (updateFields.issueType) {
						fields.issuetype = {
							id: updateFields.issueType as string,
						};
					}
					if (updateFields.labels) {
						fields.labels = updateFields.labels as string[];
					}
					if (updateFields.serverLabels) {
						fields.labels = updateFields.serverLabels as string[];
					}
					if (updateFields.priority) {
						fields.priority = {
							id: updateFields.priority as string,
						};
					}
					if (updateFields.assignee) {
						if (jiraVersion === 'server') {
							fields.assignee = {
								name: updateFields.assignee as string,
							};
						} else {
							fields.assignee = {
								id: updateFields.assignee as string,
							};
						}
					}
					if (updateFields.description) {
						fields.description = updateFields.description as string;
					}
					if (updateFields.customFieldsUi) {
						const customFields = (updateFields.customFieldsUi as IDataObject).customFieldsValues as IDataObject[];
						if (customFields) {
							const data = customFields.reduce((obj, value) => Object.assign(obj, { [`${value.fieldId}`]: value.fieldValue }), {});
							Object.assign(fields, data);
						}
					}
					const issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/api/2/issuetype', 'GET', body);
					const subtaskIssues = [];
					for (const issueType of issueTypes) {
						if (issueType.subtask) {
							subtaskIssues.push(issueType.id);
						}
					}
					if (!updateFields.parentIssueKey
						&& subtaskIssues.includes(updateFields.issueType)) {
						throw new Error('You must define a Parent Issue Key when Issue type is sub-task');

					} else if (updateFields.parentIssueKey
						&& subtaskIssues.includes(updateFields.issueType)) {
						fields.parent = {
							key: (updateFields.parentIssueKey as string).toUpperCase(),
						};
					}
					body.fields = fields;

					if (updateFields.statusId) {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}/transitions`, 'POST', { transition: { id: updateFields.statusId } });
					}

					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}`, 'PUT', body);
					returnData.push({ success: true });
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-get
			if (operation === 'get') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					if (additionalFields.fields) {
						qs.fields = additionalFields.fields as string;
					}
					if (additionalFields.fieldsByKey) {
						qs.fieldsByKey = additionalFields.fieldsByKey as boolean;
					}
					if (additionalFields.expand) {
						qs.expand = additionalFields.expand as string;
					}
					if (additionalFields.properties) {
						qs.properties = additionalFields.properties as string;
					}
					if (additionalFields.updateHistory) {
						qs.updateHistory = additionalFields.updateHistory as string;
					}
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}`, 'GET', {}, qs);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-search-post
			if (operation === 'getAll') {
				for (let i = 0; i < length; i++) {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const options = this.getNodeParameter('options', i) as IDataObject;
					const body: IDataObject = {};
					if (options.fields) {
						body.fields = (options.fields as string).split(',') as string[];
					}
					if (options.jql) {
						body.jql = options.jql as string;
					}
					if (options.expand) {
						body.expand = options.expand as string;
					}
					if (returnAll) {
						responseData = await jiraSoftwareCloudApiRequestAllItems.call(this, 'issues', `/api/2/search`, 'POST', body);
					} else {
						const limit = this.getNodeParameter('limit', i) as number;
						body.maxResults = limit;
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/search`, 'POST', body);
						responseData = responseData.issues;
					}
					returnData.push.apply(returnData, responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-changelog-get
			if (operation === 'changelog') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					if (returnAll) {
						responseData = await jiraSoftwareCloudApiRequestAllItems.call(this, 'values', `/api/2/issue/${issueKey}/changelog`, 'GET');
					} else {
						qs.maxResults = this.getNodeParameter('limit', i) as number;
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}/changelog`, 'GET', {}, qs);
						responseData = responseData.values;
					}
					returnData.push.apply(returnData, responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-notify-post
			if (operation === 'notify') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const jsonActive = this.getNodeParameter('jsonParameters', 0) as boolean;
					const body: INotify = {};
					if (additionalFields.textBody) {
						body.textBody = additionalFields.textBody as string;
					}
					if (additionalFields.htmlBody) {
						body.htmlBody = additionalFields.htmlBody as string;
					}
					if (!jsonActive) {
						const notificationRecipientsValues = (this.getNodeParameter('notificationRecipientsUi', i) as IDataObject).notificationRecipientsValues as IDataObject[];
						const notificationRecipients: INotificationRecipients = {};
						if (notificationRecipientsValues) {
							// @ts-ignore
							if (notificationRecipientsValues.reporter) {
								// @ts-ignore
								notificationRecipients.reporter = notificationRecipientsValues.reporter as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.assignee) {
								// @ts-ignore
								notificationRecipients.assignee = notificationRecipientsValues.assignee as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.assignee) {
								// @ts-ignore
								notificationRecipients.watchers = notificationRecipientsValues.watchers as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.voters) {
								// @ts-ignore
								notificationRecipients.watchers = notificationRecipientsValues.voters as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.users.length > 0) {
								// @ts-ignore
								notificationRecipients.users = notificationRecipientsValues.users.map(user => {
									return {
										accountId: user,
									};
								});
							}
							// @ts-ignore
							if (notificationRecipientsValues.groups.length > 0) {
								// @ts-ignore
								notificationRecipients.groups = notificationRecipientsValues.groups.map(group => {
									return {
										name: group,
									};
								});
							}
						}
						body.to = notificationRecipients;
						const notificationRecipientsRestrictionsValues = (this.getNodeParameter('notificationRecipientsRestrictionsUi', i) as IDataObject).notificationRecipientsRestrictionsValues as IDataObject[];
						const notificationRecipientsRestrictions: NotificationRecipientsRestrictions = {};
						if (notificationRecipientsRestrictionsValues) {
							// @ts-ignore
							if (notificationRecipientsRestrictionsValues.groups.length > 0) {
								// @ts-ignore
								notificationRecipientsRestrictions.groups = notificationRecipientsRestrictionsValues.groups.map(group => {
									return {
										name: group,
									};
								});
							}
						}
						body.restrict = notificationRecipientsRestrictions;
					} else {
						const notificationRecipientsJson = validateJSON(this.getNodeParameter('notificationRecipientsJson', i) as string);
						if (notificationRecipientsJson) {
							body.to = notificationRecipientsJson;
						}
						const notificationRecipientsRestrictionsJson = validateJSON(this.getNodeParameter('notificationRecipientsRestrictionsJson', i) as string);
						if (notificationRecipientsRestrictionsJson) {
							body.restrict = notificationRecipientsRestrictionsJson;
						}
					}
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}/notify`, 'POST', body, qs);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-transitions-get
			if (operation === 'transitions') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					if (additionalFields.transitionId) {
						qs.transitionId = additionalFields.transitionId as string;
					}
					if (additionalFields.expand) {
						qs.expand = additionalFields.expand as string;
					}
					if (additionalFields.skipRemoteOnlyCondition) {
						qs.skipRemoteOnlyCondition = additionalFields.skipRemoteOnlyCondition as boolean;
					}
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}/transitions`, 'GET', {}, qs);
					responseData = responseData.transitions;
					returnData.push.apply(returnData, responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-delete
			if (operation === 'delete') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const deleteSubtasks = this.getNodeParameter('deleteSubtasks', i) as boolean;
					qs.deleteSubtasks = deleteSubtasks;
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}`, 'DELETE', {}, qs);
					returnData.push({ success: true });
				}
			}
		}
		if (resource === 'issueAttachment') {
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/#api-rest-api-3-issue-issueidorkey-attachments-post
			if (operation === 'add') {
				for (let i = 0; i < length; i++) {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const issueKey = this.getNodeParameter('issueKey', i) as string;

					if (items[i].binary === undefined) {
						throw new Error('No binary data exists on item!');
					}

					const item = items[i].binary as IBinaryKeyData;

					const binaryData = item[binaryPropertyName] as IBinaryData;

					if (binaryData === undefined) {
						throw new Error(`No binary data property "${binaryPropertyName}" does not exists on item!`);
					}

					responseData = await jiraSoftwareCloudApiRequest.call(
						this,
						`/api/3/issue/${issueKey}/attachments`,
						'POST',
						{},
						{},
						undefined,
						{
							formData: {
								file: {
									value: Buffer.from(binaryData.data, BINARY_ENCODING),
									options: {
										filename: binaryData.fileName,
									},
								},
							},
						},
					);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/#api-rest-api-3-attachment-id-delete
			if (operation === 'remove') {
				for (let i = 0; i < length; i++) {
					const attachmentId = this.getNodeParameter('attachmentId', i) as string;
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/attachment/${attachmentId}`, 'DELETE', {}, qs);
					returnData.push({ success: true });
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/#api-rest-api-3-attachment-id-get
			if (operation === 'get') {
				const download = this.getNodeParameter('download', 0) as boolean;
				for (let i = 0; i < length; i++) {
					const attachmentId = this.getNodeParameter('attachmentId', i) as string;
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/attachment/${attachmentId}`, 'GET', {}, qs);
					returnData.push({ json: responseData });
				}
				if (download) {
					const binaryPropertyName = this.getNodeParameter('binaryProperty', 0) as string;
					for (const [index, attachment] of returnData.entries()) {
						returnData[index]['binary'] = {};
						//@ts-ignore
						const buffer = await jiraSoftwareCloudApiRequest.call(this, '', 'GET', {}, {}, attachment?.json!.content, { json: false, encoding: null });
						//@ts-ignore
						returnData[index]['binary'][binaryPropertyName] = await this.helpers.prepareBinaryData(buffer, attachment.json.filename, attachment.json.mimeType);
					}
				}
			}
			if (operation === 'getAll') {
				const download = this.getNodeParameter('download', 0) as boolean;
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const { fields: { attachment } } = await jiraSoftwareCloudApiRequest.call(this, `/api/2/issue/${issueKey}`, 'GET', {}, qs);
					responseData = attachment;
					if (returnAll === false) {
						const limit = this.getNodeParameter('limit', i) as number;
						responseData = responseData.slice(0, limit);
					}
					responseData = responseData.map((data: IDataObject) => ({ json: data }));
					returnData.push.apply(returnData, responseData);
				}
				if (download) {
					const binaryPropertyName = this.getNodeParameter('binaryProperty', 0) as string;
					for (const [index, attachment] of returnData.entries()) {
						returnData[index]['binary'] = {};
						//@ts-ignore
						const buffer = await jiraSoftwareCloudApiRequest.call(this, '', 'GET', {}, {}, attachment.json.content, { json: false, encoding: null });
						//@ts-ignore
						returnData[index]['binary'][binaryPropertyName] = await this.helpers.prepareBinaryData(buffer, attachment.json.filename, attachment.json.mimeType);
					}
				}
			}
		}

		if (resource === 'issueComment') {
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-post
			if (operation === 'add') {
				for (let i = 0; i < length; i++) {
					const jsonParameters = this.getNodeParameter('jsonParameters', 0) as boolean;
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const options = this.getNodeParameter('options', i) as IDataObject;
					const body: IDataObject = {};
					if (options.expand) {
						qs.expand = options.expand as string;
						delete options.expand;
					}

					Object.assign(body, options);
					if (jsonParameters === false) {
						const comment = this.getNodeParameter('comment', i) as string;
						Object.assign(body, {
							body: {
								type: 'doc',
								version: 1,
								content: [
									{
										type: "paragraph",
										content: [
											{
												type: 'text',
												text: comment,
											},
										],
									},
								],
							},
						});
					} else {
						const commentJson = this.getNodeParameter('commentJson', i) as string;
						const json = validateJSON(commentJson);
						if (json === '') {
							throw new Error('Document Format must be a valid JSON');
						}

						Object.assign(body, { body: json });
					}

					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/issue/${issueKey}/comment`, 'POST', body, qs);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-get
			if (operation === 'get') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const commentId = this.getNodeParameter('commentId', i) as string;
					const options = this.getNodeParameter('options', i) as IDataObject;
					Object.assign(qs, options);
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/issue/${issueKey}/comment/${commentId}`, 'GET', {}, qs);
					returnData.push(responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-get
			if (operation === 'getAll') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const options = this.getNodeParameter('options', i) as IDataObject;
					const body: IDataObject = {};
					Object.assign(qs, options);
					if (returnAll) {
						responseData = await jiraSoftwareCloudApiRequestAllItems.call(this, 'comments', `/api/3/issue/${issueKey}/comment`, 'GET', body, qs);
					} else {
						const limit = this.getNodeParameter('limit', i) as number;
						body.maxResults = limit;
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/issue/${issueKey}/comment`, 'GET', body, qs);
						responseData = responseData.comments;
					}
					returnData.push.apply(returnData, responseData);
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-id-delete
			if (operation === 'remove') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const commentId = this.getNodeParameter('commentId', i) as string;
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/issue/${issueKey}/comment/${commentId}`, 'DELETE', {}, qs);
					returnData.push({ success: true });
				}
			}
			//https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-id-put
			if (operation === 'update') {
				for (let i = 0; i < length; i++) {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const commentId = this.getNodeParameter('commentId', i) as string;
					const options = this.getNodeParameter('options', i) as IDataObject;
					const jsonParameters = this.getNodeParameter('jsonParameters', 0) as boolean;
					const body: IDataObject = {};
					if (options.expand) {
						qs.expand = options.expand as string;
						delete options.expand;
					}
					Object.assign(qs, options);
					if (jsonParameters === false) {
						const comment = this.getNodeParameter('comment', i) as string;
						Object.assign(body, {
							body: {
								type: 'doc',
								version: 1,
								content: [
									{
										type: "paragraph",
										content: [
											{
												type: 'text',
												text: comment,
											},
										],
									},
								],
							},
						});
					} else {
						const commentJson = this.getNodeParameter('commentJson', i) as string;
						const json = validateJSON(commentJson);
						if (json === '') {
							throw new Error('Document Format must be a valid JSON');
						}

						Object.assign(body, { body: json });
					}
					responseData = await jiraSoftwareCloudApiRequest.call(this, `/api/3/issue/${issueKey}/comment/${commentId}`, 'PUT', body, qs);
					returnData.push(responseData);
				}
			}
		}

		if (resource === 'issueAttachment' && (operation === 'getAll' || operation === 'get')) {
			return this.prepareOutputData(returnData as unknown as INodeExecutionData[]);
		} else {
			return [this.helpers.returnJsonArray(returnData)];
		}
	}
}