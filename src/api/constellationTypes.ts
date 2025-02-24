/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                          ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface IseuserappLoginPost {
  /** @example "myAwesomePassword" */
  password?: string;
  /** @example "scientist@science.com" */
  username?: string;
}

export interface IseuserappLoginResponse {
  /** @example "eyJ.abc123" */
  authToken?: string;
  /** @example "scientist@science.com" */
  email?: string;
  /** @example "id:abc" */
  id?: string;
  /** @example "Object.User" */
  type?: string;
  /** @example "scientist" */
  username?: string;
}

export interface ObjectReference {
  /**
   * The unique ID of the object. Guaranteed to be set.
   * @example "id:"abc""
   */
  id?: string;
  /**
   * The name of the object itself. May be set, although may not. Depends
   * on the endpoint.
   * @example "My Syringe"
   */
  name?: string;
  /**
   * The name of the type this object points to. Guaranteed to be set
   * @example "Model.Container.Syringe"
   */
  type?: string;
}

export interface ObjectReferenceUnresolved {
  /**
   * The ID of the object
   * @example "id:"abc""
   */
  id?: string;
  /** The name of the object - this will only be set on responses and cannot be set on upload */
  name?: string;
  /**
   * The type of the object
   * @example "Model.Container.Syringe"
   */
  type?: string;
}

export interface ObjsapiDownloadObjectRequest {
  /**
   * If no Fields or Traversals are specified, fetch all the fields in the object.
   * Fields should only include literal field names, to traverse links use the Traversals field
   * @example ["Name","Type"]
   */
  fields?: string[];
  /**
   * DEPRECATED: use object, ID of the object to fetch
   * @example "id:"abc""
   */
  id?: string;
  /**
   * Limit the maximum number of values returned for any multiple fields.
   * @example 100
   */
  limit?: number;
  object?: ObjectReferenceUnresolved;
  /**
   * Request downloading of fields in objects which are linked to.
   * Each FieldRequest indicates a series of traversals to make recursively.
   *
   * For example:
   * Field1->Field2[[2]]->Field3
   * The above indicates that the value of Field3 should be fetched from all links at index 2 of
   * Field2 from a links in Field1 of the object to be downloaded.
   */
  traversals?: ObjsapiFieldRequest[];
  /**
   * DEPRECATED: use object, Type of the object to fetch (Object.Protocol.HPLC for example).
   * @example "Model.Container.Syringe"
   */
  type?: string;
}

export interface ObjsapiDownloadObjectResponse {
  /**
   * Represents the version of the object when it was downloaded
   * @example "abc123"
   */
  cas?: string;
  /** Key-Value pairs for all fields in the object specified in the DownloadObjectRequest */
  fields?: Record<string, any>;
  /**
   * Deprecated, see ResolvedObject
   * @example "id:"abc""
   */
  id?: string;
  /**
   * The field length limit that was requested for this object (maximum length of multiple fields to be returned)
   * @example 100
   */
  limit?: number;
  /**
   * List of error messages encountered when trying to fulfill the DownloadObjectRequest
   * @example ["Unable to find field \"foo\""]
   */
  messages?: string[];
  /** Object as originally passed to Download */
  object?: ObjectReferenceUnresolved;
  /** Resolved object, guaranteed to have id + type if set. May also have name. */
  resolved_object?: ObjectReference;
  /**
   * An enumerated return value indicating success/failure of the DownloadObjectRequest
   * @example 0
   */
  status_code?: number;
  /**
   * All the intermediate objects traversed when following a link traversal specification (Field->Field2).
   * These will contain the link IDs for the intermediate objects for reconstructing the traversal results.
   */
  traversed_objects?: ObjsapiDownloadObjectResponse[];
  /**
   * Deprecated, see ResolvedObject
   * @example "Model.Container.Syringe"
   */
  type?: string;
}

export interface ObjsapiDownloadRequest {
  requests?: ObjsapiDownloadObjectRequest[];
}

export interface ObjsapiDownloadResponse {
  responses?: ObjsapiDownloadObjectResponse[];
}

export interface ObjsapiFieldRequest {
  /**
   * Name of the field
   * @example "Model"
   */
  name?: string;
  /**
   * Indicates the subsequent requests to make after fetching the values for the current
   * field/index
   */
  next?: ObjsapiFieldRequest[];
}

export interface ObjsapiGetTypeResponse {
  /** @example "A model for a device/part designed to aspirate and dispense liquid by moving a plunger inside a sealed cylinder." */
  description?: string;
  fields?: Record<string, any>[];
  /** @example "Model.Container.Syringe" */
  fullName?: string;
  /** @example "mKKOvR" */
  id?: string;
  /** @example "Model.Container.Syringe" */
  name?: string;
}

export interface ObjsapiObjectLog {
  data?: Record<string, any>;
  fields?: Record<string, any>;
  log_type?: string;
  object?: ObjectReferenceUnresolved;
  revision_time?: string;
  revision_user?: ObjectReferenceUnresolved;
  user?: ObjectReferenceUnresolved;
}

export interface ObjsapiObjectLogRetrieveRequest {
  /** @example ["Name","Type"] */
  fields?: string[];
  /** @example true */
  includeFieldValues?: boolean;
  /** @example 100 */
  limit?: number;
  object?: ObjectReferenceUnresolved[];
  /** @example true */
  subTypes?: boolean;
  /** @example ["Model.Container","Object.Container"] */
  types?: string[];
  userObj?: ObjectReferenceUnresolved;
}

export interface ObjsapiObjectLogRetrieveResponse {
  objectLogs?: ObjsapiObjectLog[];
}

export interface ObjsapiPutFields {
  /** JSON representation of the fields to be uploaded */
  fields?: Record<string, any>;
  /** A list of all the objects that are being modified in this upload.  This must be set when modifying existing objects */
  references?: ObjectReferenceUnresolved[];
}

export interface ObjsapiQueryInfo {
  /** @example "Name=="Foo"" */
  query?: string;
  /** @example ["Model.Container","Object.Container"] */
  types?: string[];
}

export interface ObjsapiSearchByNameObjectRequest {
  /** @example "My Syringe" */
  name?: string;
  /**
   * a soft limit of -1 returns all values
   * @example 100
   */
  softLimit?: number;
  /** @example true */
  subTypes?: boolean;
  /** @example ["Model.Container","Object.Container"] */
  types?: string[];
}

export interface ObjsapiSearchObjectRequest {
  /** Only clauses _or_ type + query may be set. */
  clauses?: ObjsapiQueryInfo[];
  /**
   * If set, all temporal links along the search paths are treated as normal links and so only the latest values will
   * be queried.
   */
  ignore_time?: boolean;
  /**
   * What ordering to use for search results. Default is ReverseNewestFirst.
   * Available orderings are OldestFirst, NewestFirst, and ReverseNewestFirst
   * @example "NewestFirst"
   */
  ordering?: string;
  /**
   * A limit on the number of results which may be exceeded, but once exceeded
   * will cause processing to exit early. May not return stable results,
   * just will return at least limit if there are more than limit results.
   * Allows for some search optimizations
   * @example 100
   */
  softLimit?: number;
  /**
   * Whether or not to include subtypes
   * @example true
   */
  subTypes?: boolean;
}

export interface ObjsapiSearchRequest {
  queries?: ObjsapiSearchObjectRequest[];
}

export interface ObjsapiSearchResponse {
  results?: ObjsapiSearchResultObject[];
}

export interface ObjsapiSearchResultObject {
  references?: ObjectReference[];
}

export interface ObjsapiUploadObjectRequest {
  /** Key/Value pairs containing the data to upload to the object */
  fields?: ObjsapiPutFields;
  /**
   * DEPRECATED - Use object field instead: The ID of a the object to modify. Should not be specified if this is a creation
   * @example "id:"abc""
   */
  id?: string;
  /** The object being modified */
  object?: ObjectReferenceUnresolved;
  /**
   * DEPRECATED - Use object field instead: Type of the object to create (if ID is specified this will be ignored).
   * @example "Model.Container.Syringe"
   */
  type?: string;
}

export interface ObjsapiUploadObjectResponse {
  cas?: string;
  /** Deprecated, see Object */
  client_id?: string;
  /** Deprecated, see Object */
  id?: string;
  new_object?: boolean;
  /** Object exactly as uploaded in the UploadRequest */
  object?: ObjectReferenceUnresolved;
  /**
   * Resolved object which will contain Type + ID. Unset if the object
   * reference couldn't be resolved for any reason.
   */
  resolved_object?: ObjectReference;
  /** Deprecated, see Object */
  type?: string;
}

export interface ObjsapiUploadRequest {
  requests?: ObjsapiUploadObjectRequest[];
}

export interface ObjsapiUploadResponse {
  /**
   * List of all object.ReferenceUnresolved which had ClientIDs in this request
   * that includes in the ReferenceUnresolved the new Objectstore Object id.
   */
  client_id_objects?: ObjectReferenceUnresolved[];
  /** If there was an error completing the upload, further information will be provided in the Message */
  message?: string;
  /** List of object IDs modified during this upload */
  modified_references?: ObjectReference[];
  /** List of all new objects created (including previously empty objects which have been uploaded to) */
  new_objects?: ObjectReference[];
  /** List of responses with for the objects which were updated. This will be empty if there was an error */
  responses?: ObjsapiUploadObjectResponse[];
  /**
   * Will be UploadStatusOK for a successful request or one of the additional status codes for other
   * specific failure scenarios
   */
  status_code?: number;
}

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
} 